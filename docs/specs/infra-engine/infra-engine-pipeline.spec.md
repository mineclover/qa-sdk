---
def:
  id: infra-engine-pipeline
  scope: feature
  aspect: func_def
  depth: specification
  tier: layout
  lifecycle: approved
  layer: operation
  svc: infra-engine
  tags: [infra, devops, gitops]
  links:
    - target: infra-config-stage
      type: refs
    - target: infra-provision-stage
      type: refs
    - target: infra-register-stage
      type: refs
    - target: infra-verify-stage
      type: depends_on
    - target: infra-observe-stage
      type: refs
    - target: infra-providers
      type: refs
    - target: infra-adapters
      type: refs
    - target: infra-monitoring
      type: refs
    - target: infra-discovery
      type: refs
    - target: infra-service-operations
      type: traces_to
    - target: infra-engine-todo
      type: traces_to
    - target: infra-auth-integration-todo
      type: refs
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

파이프라인 실행 중 스테이지가 실패하면, **파이프라인 실행기가** 이미 완료된 스테이지를 역순으로 rollback한다. 개별 스테이지는 자신의 `rollback()` 구현만 책임지며, cascade 호출은 실행기가 관리한다.

| 실패 지점 | 실행기가 호출하는 rollback |
|-----------|--------------------------|
| ConfigStage | 없음 (읽기 전용) |
| ProvisionStage | ProvisionStage.rollback() — Pulumi destroy |
| RegisterStage | RegisterStage.rollback() → ProvisionStage.rollback() |
| VerifyStage | RegisterStage.rollback() → ProvisionStage.rollback() |
| ObserveStage | 없음 — 경고만 기록 (fail-open) |

**fail-open 정의**: 스테이지가 성공을 반환하되 `warnings` 배열에 실패 사유를 기록한다. 파이프라인은 중단하지 않으며, 호출자는 `warnings`를 로깅만 한다. ObserveStage 전체가 fail-open이다.

### 실행 보장

- **순차 실행**: 스테이지는 반드시 정의된 순서대로 실행
- **동시 배포 차단**: 같은 (service, env, provider, region) 조합에 대한 동시 배포는 DynamoDB lock이 차단
- **triggeredBy**: 파이프라인 입력에 `triggeredBy: "ci" | "manual"` 포함 (기본: "manual")

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
  readonly triggeredBy: "ci" | "manual";  // 기본: "manual"

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

- `sops` CLI 바이너리 — Mozilla SOPS (shell-out via `execa`)
- `@pulumi/pulumi` `^3.229.0` — Automation API
- `@aws-sdk/client-s3` `^3.1024.0` — S3 state backend
- `@aws-sdk/client-dynamodb` `^3.1024.0` — DynamoDB lock
- `@aws-sdk/client-kms` `^3.1024.0` — KMS 복호화
- `@aws-sdk/client-sts` `^3.1024.0` — OIDC STS 임시 토큰
- `zod` — 설정 스키마 검증
- `execa` `^9.0.0` — sops CLI 실행

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
| [infra-discovery](infra-discovery.spec.md) | 서비스 디스커버리 + Fleet 관리 + export 도구 |

---

## 현재 규모

- **71 소스**, **220+ 테스트** (unit 106 + cli-command 23 + auth 57 + demo 37 + gateway 12 + advanced 24 + resilience 28 + login-flow 30)
- **33 CLI 명령**, **4 skills**, **13 스펙**
- **8 설정 파일** (test/dev/local/stage/prod/cloudflare-prod/test-nginx/test-nginx-v2)
- **배포**: K3s dev 9서비스 + CF prod 3서비스 (decode/gate/query) = 12서비스
- **인프라**: Docker Compose (MinIO + Zitadel + CockroachDB) + K3s 클러스터
- **인증**: JWKS RS256 + HS256 bitmask O(1) + 12 features x 3 roles

## 패키지 구조

```
packages/infra-engine/
  ├── src/                             # 71 소스 파일
  │   ├── core/                        # 파이프라인 엔진 (범용, qa-sdk 무의존)
  │   │   ├── types.ts                 # DeployContext, DeployResult, Stage 등
  │   │   └── pipeline.ts              # DeployPipeline 실행기
  │   │
  │   ├── config/                      # SOPS + 설정 해석
  │   │   ├── config-schema.ts         # 통합 설정 zod 스키마
  │   │   ├── sops-loader.ts           # SOPS 복호화
  │   │   ├── config-stage.ts          # ConfigStage 구현
  │   │   └── env-bridge.ts            # SOPS YAML → 서비스별 env 변환
  │   │
  │   ├── adapters/                    # 외부 시스템 연동 (교체 가능)
  │   │   ├── adapter.ts               # Adapter 인터페이스 정의 (6포트)
  │   │   ├── gate.ts                  # → 품질 게이트 평가
  │   │   ├── infra-profile.ts         # → infra-profile.json
  │   │   ├── service-profile.ts       # → service-profile.json
  │   │   ├── registry.ts              # → registry-service API
  │   │   ├── ingest.ts                # → ingest-server 이벤트 emit
  │   │   ├── coordinate.ts            # → 좌표 인코딩 (fail-open)
  │   │   └── definition.ts            # → definition-service (문서/테스트/prefix)
  │   │
  │   ├── providers/                   # Pulumi Program per provider
  │   │   ├── registry.ts              # 프로바이더 레지스트리
  │   │   ├── local.ts                 # Local K3s 프로바이더
  │   │   ├── pulumi-deploy.ts         # Pulumi Automation API 래퍼
  │   │   ├── all.ts                   # 전체 프로바이더 집합
  │   │   ├── cloudflare.ts            # Cloudflare 프로바이더 (스텁)
  │   │   ├── railway.ts               # Railway 프로바이더 (스텁)
  │   │   ├── aws.ts                   # AWS 프로바이더 (스텁)
  │   │   ├── gcp.ts                   # GCP 프로바이더 (스텁)
  │   │   └── vultr.ts                 # Vultr 프로바이더 (스텁)
  │   │
  │   ├── stages/                      # 5단계 스테이지 구현
  │   │   ├── provision-stage.ts       # ProvisionStage — Pulumi 실행
  │   │   ├── register-stage.ts        # RegisterStage — registry 등록
  │   │   └── observe-stage.ts         # ObserveStage — 이벤트 emit + 모니터링 등록
  │   │
  │   ├── verify/                      # 헬스체크 & 품질 게이트
  │   │   ├── health-check.ts          # HTTP/TCP 프로브
  │   │   ├── gate-definitions.ts      # 배포 품질 게이트 정의
  │   │   └── verify-stage.ts          # VerifyStage — 헬스체크 + 게이트 평가
  │   │
  │   ├── discovery/                   # 서비스 디스커버리
  │   │   ├── client.ts                # DiscoveryClient (registry 기반)
  │   │   └── enhanced-client.ts       # EnhancedDiscovery (registry + definition 통합)
  │   │
  │   ├── fleet/                       # Fleet 관리
  │   │   └── manager.ts               # FleetManager (status, tier 그룹핑)
  │   │
  │   ├── export/                      # 설정 파일 생성 도구
  │   │   ├── env-file.ts              # .env 파일 생성 (config → env 변환 포함)
  │   │   ├── typescript-module.ts     # TypeScript 서비스 연결 모듈
  │   │   └── docker-compose.ts        # docker-compose.override.yml
  │   │
  │   ├── monitor/                     # 모니터링 & 대시보드
  │   │   ├── sync-loop.ts             # 주기적 상태 동기화 (ArgoCD 스타일)
  │   │   ├── dashboard.ts             # FleetStatus 집계 + 대시보드 데이터
  │   │   ├── auto-recovery.ts         # OutOfSync 자동 재배포
  │   │   └── sla.ts                   # SLA 추적 (uptime 계산)
  │   │
  │   ├── post-deploy/                 # 배포 후 자동화 (codegen, cascade, version)
  │   │   ├── codegen.ts               # 배포 후 TS 모듈 + .env 재생성
  │   │   ├── cascade.ts               # depends_on 기반 의존 서비스 감지
  │   │   ├── version-manager.ts       # 배포 버전 기록 + rollback (JSON 영속)
  │   │   └── sync.ts                  # infra-profile 기록 + definition-service 동기화
  │   │
  │   ├── auth/                         # 인증/인가
  │   │   ├── enrichment-server.ts     # Permission enrichment HTTP 서버 (3 roles x 12 features)
  │   │   └── test-jwt.ts              # JWT 테스트 유틸
  │   │
  │   ├── commands/                    # 비즈니스 로직 구현
  │   │   ├── destroy.ts               # destroy (Pulumi destroy + 정리)
  │   │   ├── audit.ts                 # audit (registry 데이터 품질 점검)
  │   │   ├── config-manager.ts        # config (프로필 전환, 필드 변경)
  │   │   ├── env-manager.ts           # env (MinIO S3 + K8s 로컬 환경 관리)
  │   │   └── secrets-manager.ts       # secrets (시크릿 관리)
  │   │
  │   ├── cli/                         # CLI 명령 트리 (cli-command 기반)
  │   │   ├── tree.ts                  # 26개 명령 트리 정의
  │   │   ├── context.ts               # PROFILE_DIR, REGISTRY_URL, DEFINITION_URL
  │   │   ├── index.ts                 # CLI 진입점
  │   │   ├── cmd-deploy.ts            # deploy (--sync: codegen + cascade)
  │   │   ├── cmd-destroy.ts           # destroy
  │   │   ├── cmd-discover.ts          # discover (--all/--list/--deep/--code)
  │   │   ├── cmd-export.ts            # export (env/ts/compose/docs)
  │   │   ├── cmd-status.ts            # status (Fleet 상태)
  │   │   ├── cmd-history.ts           # history (배포 이력)
  │   │   ├── cmd-audit.ts             # audit (registry 감사)
  │   │   ├── cmd-config.ts            # config (show/use/set/presets)
  │   │   ├── cmd-monitor.ts           # monitor (start/check/status)
  │   │   ├── cmd-dashboard.ts         # dashboard (summary/service/export)
  │   │   ├── cmd-env.ts               # env (up/down/status/reset)
  │   │   ├── cmd-pf.ts               # pf (list/register/remove/cleanup)
  │   │   ├── cmd-version.ts           # version (list/show/rollback)
  │   │   ├── cmd-secrets.ts           # secrets (show/init/rotate)
  │   │   └── cmd-enrichment.ts        # enrichment (start/setup)
  │   │
  │   ├── lib/                         # 공용 유틸리티
  │   │   └── validation.ts            # 보안 검증 (ID/경로/PID/URL 유효성)
  │   │
  │   └── index.ts                     # public export
  │
  ├── scripts/                         # CLI 진입점
  │   ├── infra.ts                     # 통합 CLI (cli-command 트리 기반)
  │   ├── deploy-local.ts              # 로컬 배포 (레거시, infra.ts에서 위임)
  │   ├── discover.ts                  # 디스커버리 (레거시, infra.ts에서 위임)
  │   ├── export.ts                    # export (레거시, infra.ts에서 위임)
  │   ├── test-auth-lifecycle.ts       # AuthN/AuthZ 라이프사이클 테스트 (57건)
  │   ├── test-gateway.ts              # Gateway 통합 테스트 (12건)
  │   ├── test-advanced.ts             # 고급 시나리오 테스트 (24건)
  │   ├── test-resilience.ts           # 장애 복구 테스트 (28건)
  │   ├── test-login-flow.ts           # 로그인 플로우 테스트 (30건)
  │   ├── test-oidc-browser.ts         # OIDC 브라우저 테스트 서버
  │   └── setup-zitadel-action.ts      # Zitadel Action 설정
  │
  ├── test/                            # 브라우저 테스트
  │   └── oidc-login.html              # OIDC + PKCE 브라우저 로그인 테스트 UI
  │
  ├── config/                          # 환경별 설정 JSON (8개)
  │   ├── test.json
  │   ├── dev.json
  │   ├── local.json
  │   ├── stage.json
  │   ├── prod.json
  │   ├── cloudflare-prod.json
  │   ├── test-nginx.json
  │   └── test-nginx-v2.json
  │
  ├── docs/
  │   ├── k3d-local-setup.md           # K3s 로컬 클러스터 설정 가이드
  │   └── local-infra-plan.md          # 로컬 인프라 계획
  │
  ├── sops.yaml                        # SOPS 암호화 규칙 (템플릿)
  ├── tsup.config.ts
  └── package.json
```

## 설계 원칙

1. **core/ 는 qa-sdk 무의존** — Stage, Pipeline, DeployContext는 범용 타입. 다른 프로젝트에서도 재사용 가능
2. **adapters/ 가 경계** — qa-sdk의 registry, ingest, gate 체계와의 연결은 모두 어댑터를 통해
3. **fail-open** — ObserveStage 실패는 배포를 차단하지 않음. VerifyStage 실패만 rollback 트리거
4. **SOPS YAML = SSOT** — 시크릿 + 일반설정 + 서비스 연결정보를 한 곳에서 관리
5. **사용자가 프로바이더 선택** — provider 파라미터로 배포 대상 지정. 역할 고정 없음
