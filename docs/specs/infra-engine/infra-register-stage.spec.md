---
def:
  id: infra-register-stage
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [infra, registry, service-discovery]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-provision-stage
      type: depends_on
---
# RegisterStage — 레지스트리 등록 + 서비스 프로필

## 목적 ^purpose

프로비저닝 완료 후, 배포된 서비스의 메타데이터(endpoint, region, env, provider)를 registry-service에 자동 등록하고 service-profile.json을 갱신하여, 서비스 간 디스커버리와 데이터 계보 추적을 가능하게 한다.

## 구성 ^overview

- **registry-service 등록**: 배포 결과를 POST → 서비스 식별자 + 인프라 메타데이터 기록
- **service-profile 갱신**: 배포된 endpoint를 service-profile.json에 반영 → CLI/다른 서비스가 URL 탐색 가능
- **연결 검증**: depends_on에 명시된 서비스들의 endpoint 도달 가능성 사전 확인
- **어댑터 패턴**: registry-service / service-profile 접근은 어댑터를 통해 — qa-sdk 무의존 코어 유지

---

## 등록 데이터 모델

### DeploymentRecord — 레지스트리에 기록되는 배포 정보

```typescript
interface DeploymentRecord {
  serviceId: string;         // "ingest-server"
  provider: string;          // "railway"
  env: string;               // "staging"
  region: string;            // "ap-northeast-2"
  endpoint: string;          // "https://ingest-staging.up.railway.app"
  healthPath: string;        // "/health"
  version?: string;          // 배포 버전 (git sha 또는 semver)
  deployedAt: string;        // ISO-8601
  stackName: string;         // Pulumi 스택 이름
  metadata: Record<string, string>;  // 프로바이더별 추가 정보
}
```

### RegistrationResult

```typescript
interface RegistrationResult {
  registryId: string;        // registry-service가 부여한 ID
  profileUpdated: boolean;   // service-profile 갱신 성공 여부
  connectionChecks: ConnectionCheck[];
}

interface ConnectionCheck {
  target: string;            // depends_on 서비스 ID
  reachable: boolean;
  latency?: number;          // ms
}
```

## 실행 흐름

```
ProvisionResult (endpoint, provider, region)
  │
  ├─ 1. registry-service 등록
  │     POST /v1/services/{serviceId}/deployments
  │     body: DeploymentRecord
  │     → registryId
  │
  ├─ 2. service-profile.json 갱신
  │     serviceId → endpoint 매핑 추가/업데이트
  │     ~/.qa-sdk/service-profile.json
  │
  └─ 3. 연결 사전 검증 (depends_on)
        config.services[serviceId].depends_on 순회
        → 각 대상의 connections[target].endpoint에 HEAD 요청
        → ConnectionCheck[] 결과
```

### registry-service API 확장

기존 registry-service에 배포 정보 엔드포인트 추가:

| Method | Path | 기능 |
|--------|------|------|
| POST | `/v1/services/{serviceId}/deployments` | 배포 기록 등록 |
| GET | `/v1/services/{serviceId}/deployments` | 배포 이력 조회 |
| GET | `/v1/services/{serviceId}/deployments/active` | 현재 활성 배포 |
| DELETE | `/v1/services/{serviceId}/deployments/{id}` | 배포 기록 삭제 (rollback 시) |

### service-profile 확장

기존 `~/.qa-sdk/service-profile.json` 구조에 인프라 메타데이터 추가:

```jsonc
{
  "mode": "staging",
  "services": {
    "ingest-server": {
      "url": "https://ingest-staging.up.railway.app",
      // 확장 필드
      "provider": "railway",
      "region": "ap-northeast-2",
      "deployedAt": "2026-04-05T10:30:00Z",
      "healthPath": "/health"
    }
  }
}
```

## 정의 ^defines

- `DeploymentRecord` — 레지스트리에 기록되는 배포 단위
- `RegistrationResult` — 등록 + 프로필 갱신 + 연결 검증 결과
- `RegistryAdapter` — registry-service HTTP 호출 추상화 (adapters/registry.ts)
- `ServiceProfileAdapter` — service-profile.json 읽기/쓰기 추상화 (adapters/service-profile.ts)

## 소비 ^consumes

- `RegistryAdapter` — registry-service API 호출
- `ServiceProfileAdapter` — service-profile.json 파일 I/O
- `ResolvedConfig.connections` — 서비스 간 연결정보
- `ProvisionResult.outputs` — 배포 산출물 (endpoint 등)

## Rollback

```typescript
async rollback(ctx: DeployContext): Promise<void> {
  // 1. registry 등록 취소
  await registryAdapter.deleteDeployment(ctx.service, ctx.registration.registryId);
  // 2. service-profile 복원 (이전 값으로)
  await profileAdapter.restore(ctx.service);
}
```
