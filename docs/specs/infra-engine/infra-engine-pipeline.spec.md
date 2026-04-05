---
def:
  id: infra-engine-pipeline
  scope: system
  aspect: func_def
  depth: specification
  level: module
  lifecycle: draft
  layer: operation
  tags: [infra, devops, gitops]
  links: []
---
# 인프라 엔진 배포 파이프라인

## 목적 ^purpose

애플리케이션 배포를 5단계 파이프라인으로 추상화하여, 멀티 프로바이더(Cloudflare, AWS, GCP, Railway, Vultr, 온프레미스) 환경에서 서비스 배포 + 설정 주입 + 레지스트리 등록 + 품질 검증 + 관측을 자동화한다.

## 구성 ^overview

- **패키지**: `packages/infra-engine` (qa-sdk 모노레포 내)
- **범위**: 애플리케이션 배포 중심 (VM/네트워크 프로비저닝은 범위 밖)
- **엔진**: Pulumi Automation API (프로바이더별 추상화)
- **설정 SSOT**: SOPS + KMS 암호화 YAML (시크릿 + 일반설정 + 서비스 연결정보)
- **상태 관리**: AWS S3 (Pulumi state) + DynamoDB (Lock)
- **코어는 qa-sdk 무의존** — 어댑터 계층을 통해 연동

## 방법 ^method

5단계 파이프라인이 순차 실행되며, 각 스테이지의 출력이 다음 스테이지의 입력이 된다. 실패 시 역순 rollback.

### 파이프라인 실행 흐름

```
사용자 입력 (service, provider, env, region, configPath)
  │
  ▼
┌─ ConfigStage ──────────────────────────────────┐
│  SOPS 복호화 → zod 검증 → ResolvedConfig       │
│  spec: infra-config-stage                      │
└────────────────────────────────────────────────┘
  │
  ▼
┌─ ProvisionStage ───────────────────────────────┐
│  Pulumi Automation API → 프로바이더별 Program    │
│  S3 state lock → deploy → unlock               │
│  spec: infra-provision-stage                   │
└────────────────────────────────────────────────┘
  │
  ▼
┌─ RegisterStage ────────────────────────────────┐
│  registry-service POST → 서비스 등록            │
│  service-profile.json 갱신                     │
│  spec: infra-register-stage                    │
└────────────────────────────────────────────────┘
  │
  ▼
┌─ VerifyStage ──────────────────────────────────┐
│  헬스체크 (HTTP/TCP probe)                      │
│  품질 게이트 평가 (응답시간, 상태코드, 연결성)    │
│  실패 시 → rollback 트리거                      │
│  spec: infra-verify-stage                      │
└────────────────────────────────────────────────┘
  │
  ▼
┌─ ObserveStage ─────────────────────────────────┐
│  배포 이벤트 → ingest-server emit               │
│  모니터링 등록 (sync-loop 대상 추가)             │
│  spec: infra-observe-stage                     │
└────────────────────────────────────────────────┘
  │
  ▼
DeployResult { endpoint, registryId, healthStatus, gateVerdict }
```

### Rollback 전략

파이프라인 실행 중 스테이지가 실패하면, 이미 완료된 스테이지를 역순으로 rollback한다.

| 실패 지점 | rollback 대상 |
|-----------|--------------|
| ConfigStage | 없음 (읽기 전용) |
| ProvisionStage | Pulumi destroy (리소스 정리) |
| RegisterStage | registry 등록 취소 + service-profile 복원 |
| VerifyStage | ProvisionStage rollback + RegisterStage rollback |
| ObserveStage | 경고만 (배포 자체는 성공, 관측 실패는 fail-open) |

ObserveStage는 **fail-open** — 관측 실패가 배포 성공을 뒤집지 않는다.

## 정의 ^defines

### DeployContext — 스테이지 간 데이터 흐름

```typescript
interface DeployContext {
  // 사용자 입력 (불변)
  readonly service: string;      // 서비스 식별자
  readonly provider: string;     // "cloudflare" | "aws" | "gcp" | "railway" | "vultr" | "local"
  readonly env: string;          // "dev" | "staging" | "prod"
  readonly region: string;       // "ap-northeast-2" 등
  readonly configPath: string;   // SOPS YAML 경로

  // 스테이지가 순차적으로 채우는 필드
  config?: ResolvedConfig;
  provision?: ProvisionResult;
  registration?: RegistrationResult;
  verification?: VerifyResult;
  observation?: ObserveResult;
}
```

### Stage — 파이프라인 스테이지 인터페이스

```typescript
interface Stage {
  readonly name: string;
  execute(ctx: DeployContext): Promise<DeployContext>;
  rollback?(ctx: DeployContext): Promise<void>;
}
```

### DeployPipeline — 파이프라인 실행기

```typescript
interface DeployPipeline {
  readonly stages: readonly Stage[];
  run(input: DeployContext): Promise<DeployResult>;
}
```

### DeployResult — 최종 산출물

```typescript
interface DeployResult {
  success: boolean;
  endpoint?: string;
  registryId?: string;
  healthStatus: "healthy" | "degraded" | "failed";
  gateVerdict: "pass" | "warn" | "fail";
  duration: number;          // ms
  stageResults: StageResult[];
}

interface StageResult {
  stage: string;
  status: "success" | "failed" | "skipped" | "rolled_back";
  duration: number;
  error?: string;
}
```

## 소비 ^consumes

- `node-sops` — SOPS 복호화
- `@pulumi/pulumi` — Automation API
- `aws-sdk` — S3/DynamoDB state backend
- `zod` — 설정 스키마 검증

## 위임 ^delegates

| 하위 스펙 | 역할 |
|-----------|------|
| [infra-config-stage](infra-config-stage.spec.md) | SOPS 복호화 + zod 검증 |
| [infra-provision-stage](infra-provision-stage.spec.md) | Pulumi 실행 + 프로바이더 분기 |
| [infra-register-stage](infra-register-stage.spec.md) | registry-service 등록 + service-profile |
| [infra-verify-stage](infra-verify-stage.spec.md) | 헬스체크 + 품질 게이트 |
| [infra-observe-stage](infra-observe-stage.spec.md) | 배포 이벤트 emit + 모니터링 |
| [infra-providers](infra-providers.spec.md) | 프로바이더별 Pulumi Program |
| [infra-adapters](infra-adapters.spec.md) | qa-sdk 연동 어댑터 |
| [infra-monitoring](infra-monitoring.spec.md) | ArgoCD 스타일 모니터링 |

---

## 패키지 구조

```
packages/infra-engine/
  ├── src/
  │   ├── core/                    # 파이프라인 엔진 (범용, qa-sdk 무의존)
  │   │   ├── pipeline.ts          # DeployPipeline 실행기
  │   │   ├── stages.ts            # Stage 인터페이스 + 내장 스테이지
  │   │   └── types.ts             # DeployContext, DeployResult 등
  │   │
  │   ├── providers/               # Pulumi Program per provider
  │   │   ├── provider.ts          # DeployProvider 인터페이스
  │   │   ├── cloudflare.ts
  │   │   ├── aws.ts
  │   │   ├── gcp.ts
  │   │   ├── railway.ts
  │   │   ├── vultr.ts
  │   │   └── local.ts
  │   │
  │   ├── config/                  # SOPS + 설정 해석
  │   │   ├── sops-loader.ts       # SOPS 복호화
  │   │   ├── config-schema.ts     # 통합 설정 zod 스키마
  │   │   └── env-bridge.ts        # SOPS YAML → 서비스별 env 변환
  │   │
  │   ├── adapters/                # 외부 시스템 연동 (교체 가능)
  │   │   ├── adapter.ts           # Adapter 인터페이스 정의
  │   │   ├── registry.ts          # → registry-service API
  │   │   ├── ingest.ts            # → ingest-server 이벤트
  │   │   ├── service-profile.ts   # → service-profile.json
  │   │   └── gate.ts              # → 품질 게이트 평가
  │   │
  │   ├── verify/                  # 헬스체크 & 품질 게이트
  │   │   ├── health-check.ts      # HTTP/TCP 프로브
  │   │   └── gate-definitions.ts  # 배포 품질 게이트 정의
  │   │
  │   ├── monitor/                 # 상태 조회 & 대시보드 데이터
  │   │   ├── status.ts            # 서비스별 배포 상태 집계
  │   │   └── sync-loop.ts         # 주기적 상태 동기화
  │   │
  │   └── index.ts
  │
  ├── config/                      # SOPS 암호화 환경별 설정
  │   ├── dev.yaml
  │   ├── staging.yaml
  │   └── prod.yaml
  │
  ├── sops.yaml                    # SOPS 암호화 규칙
  ├── tsup.config.ts
  └── package.json
```

## 설계 원칙

1. **core/ 는 qa-sdk 무의존** — Stage, Pipeline, DeployContext는 범용 타입. 다른 프로젝트에서도 재사용 가능
2. **adapters/ 가 경계** — qa-sdk의 registry, ingest, gate 체계와의 연결은 모두 어댑터를 통해
3. **fail-open** — ObserveStage 실패는 배포를 차단하지 않음. VerifyStage 실패만 rollback 트리거
4. **SOPS YAML = SSOT** — 시크릿 + 일반설정 + 서비스 연결정보를 한 곳에서 관리
5. **사용자가 프로바이더 선택** — provider 파라미터로 배포 대상 지정. 역할 고정 없음
