---
def:
  id: infra-register-stage
  scope: feature
  aspect: func_def
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, registry, service-discovery]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-provision-stage
      type: depends_on
sources:
  - packages/infra-engine/src/stages/register-stage.ts
  - packages/infra-engine/__tests__/stages/register-stage.test.ts
  - packages/infra-engine/src/adapters/registry.ts
  - packages/infra-engine/src/adapters/service-profile.ts
  - packages/infra-engine/src/adapters/infra-profile.ts
---
# RegisterStage — 레지스트리 등록 + 인프라 프로필

## 목적 ^purpose

프로비저닝 완료 후, 배포된 서비스의 메타데이터를 기존 registry-service의 `deployments/sync` API로 동기화하고, 별도의 인프라 프로필(`infra-profile.json`)에 확장 메타데이터를 기록하여, 서비스 간 디스커버리와 데이터 계보 추적을 가능하게 한다.

## 구성 ^overview

- **registry-service 동기화**: 기존 `POST /api/services/:serviceId/deployments/sync` 엔드포인트 사용 — 새 API 추가 없음
- **service-profile 갱신**: 기존 `~/.qa-sdk/service-profile.json`의 `services[id]` URL 문자열만 업데이트 — 스키마 변경 없음
- **infra-profile 기록**: 확장 메타데이터(provider, region, healthPath 등)는 별도 `~/.qa-sdk/infra-profile.json`에 저장
- **연결 검증**: depends_on에 명시된 서비스들의 endpoint 도달 가능성 사전 확인
- **어댑터 패턴**: 모든 외부 I/O는 어댑터를 통해 — 코어는 qa-sdk 무의존

---

## registry-service 연동 — 기존 API 활용

기존 `POST /api/services/:serviceId/deployments/sync` 엔드포인트를 그대로 사용한다. 새 엔드포인트 추가 없음.

### 기존 DeploymentBinding 타입 (registry-service)

```typescript
// registry-service/src/modules/services/service.types.ts 그대로 사용
interface DeploymentAddress {
  readonly serviceId: string;
  readonly runtime: RuntimeServiceAddress;
  readonly provider: string;        // "aws" | "railway" | "gcp" 등
  readonly project: string;         // 클라우드 프로젝트 ID
  readonly stack: string;           // Pulumi 스택 이름
  readonly resourceKey: string;     // 리소스 식별자
}

interface RuntimeServiceAddress {
  readonly serviceId: string;
  readonly namespace: string;       // "shop" 등
  readonly name: string;            // 서비스 display name
  readonly env: string;             // "dev" | "staging" | "prod"
  readonly region: string;          // "ap-northeast-2" 등
}

interface DeploymentBinding {
  readonly deploymentVersion: string;
  readonly address: DeploymentAddress;
  readonly observedAt: string;      // ISO-8601
  readonly urn?: string;            // Pulumi URN
  readonly url?: string;            // 배포 URL (endpoint)
  readonly outputs?: Readonly<Record<string, unknown>>;
}
```

### API 호출

```
POST /api/services/{serviceId}/deployments/sync?catalog={catalogId}

Body: {
  deploymentVersion: string,       // git sha 또는 semver
  runtime: {
    namespace: string,
    name: string,
    env: string,
    region: string,
  },
  provider: string,
  project: string,                 // Pulumi project name
  stack: string,                   // Pulumi stack name
  resourceKey: string,             // 프로바이더 리소스 ID
  url?: string,                    // endpoint URL
  urn?: string,                    // Pulumi URN
  outputs?: Record<string, unknown>,
}
```

- `catalog` 쿼리 파라미터: 기본값 "demo", SOPS config에서 지정 가능
- 응답: component upsert 결과 + `synced: true` + `manifestImpact`

## 프로필 전략 — 기존 스키마 보존 + 별도 확장

### service-profile.json — URL만 업데이트 (기존 스키마 유지)

```typescript
// 기존 구조 그대로 — services는 Record<string, string>
interface ServiceProfile {
  mode: ServiceMode;              // "local" | "staging" | "prod"
  insightsDriver: InsightsDriver;
  services: Record<string, string>;  // serviceId → URL 문자열
  appHub?: AppHubConfig;
}
```

RegisterStage는 `services[serviceId]` 값만 새 endpoint URL로 교체한다.
`getServiceUrl()` 호환성 완전 보장.

### infra-profile.json — 확장 메타데이터 (신규)

```typescript
// ~/.qa-sdk/infra-profile.json — 인프라 엔진 전용
interface InfraProfile {
  deployments: Record<string, InfraDeploymentEntry>;
}

interface InfraDeploymentEntry {
  serviceId: string;
  provider: string;
  env: string;
  region: string;
  endpoint: string;
  healthPath: string;             // 기본: "/health"
  stackName: string;              // Pulumi 스택 이름
  deploymentVersion: string;      // git sha 또는 semver
  deployedAt: string;             // ISO-8601
  triggeredBy: "ci" | "manual";
  metadata: Record<string, string>;  // 프로바이더별 추가 정보
}
```

- service-profile.json과 독립 — 기존 CLI 도구에 영향 없음
- 모니터링 sync-loop가 이 파일을 읽어서 헬스체크 대상 파악
- rollback용 이전 값은 `~/.qa-sdk/infra-profile.rollback.json`에 백업 (크래시 안전)

## 정의 ^defines

### RegistrationResult

```typescript
interface RegistrationResult {
  synced: boolean;                // registry-service 동기화 성공
  manifestImpact?: string;       // 영향받는 매니페스트 정보
  profileUpdated: boolean;       // service-profile URL 갱신 성공
  infraProfileUpdated: boolean;  // infra-profile 기록 성공
  connectionChecks: ConnectionCheck[];
}

interface ConnectionCheck {
  target: string;                // depends_on 서비스 ID
  reachable: boolean;
  latency?: number;              // ms
}
```

## 실행 흐름

```
ProvisionResult (outputs.endpoint, stackName, provider, region)
  │
  ├─ 1. registry-service 동기화
  │     POST /api/services/{serviceId}/deployments/sync?catalog={catalogId}
  │     body: ProvisionResult → DeploymentBinding 변환
  │     → synced: true + manifestImpact
  │
  ├─ 2. service-profile.json URL 업데이트
  │     services[serviceId] = outputs.endpoint (문자열)
  │     기존 getServiceUrl() 호환 유지
  │
  ├─ 3. infra-profile.json 확장 메타데이터 기록
  │     deployments[serviceId] = InfraDeploymentEntry
  │     이전 값 → infra-profile.rollback.json 백업
  │
  └─ 4. 연결 사전 검증 (depends_on)
        config.services[serviceId].depends_on 순회
        → 각 대상 endpoint에 HEAD 요청
        → ConnectionCheck[] 결과
```

## 소비 ^consumes

- `RegistryAdapter` — registry-service `deployments/sync` API 호출
- `ServiceProfileAdapter` — service-profile.json URL 읽기/쓰기
- `InfraProfileAdapter` — infra-profile.json 확장 메타데이터 관리
- `ResolvedConfig.connections` — 서비스 간 연결정보
- `ProvisionResult.outputs` — 배포 산출물 (endpoint 필수)

## Rollback

```typescript
async rollback(ctx: DeployContext): Promise<void> {
  // 1. infra-profile 복원 (rollback 파일에서)
  await infraProfileAdapter.restore(ctx.service);
  // 2. service-profile URL 복원 (rollback 파일에서)
  await profileAdapter.restore(ctx.service);
  // 참고: registry-service의 deployments/sync는 멱등 — 이전 버전으로 다시 sync하면 됨
}
```
