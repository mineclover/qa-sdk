---
def:
  id: infra-adapters
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  tier: component
  lifecycle: approved
  layer: mediation
  tags: [infra, adapter, integration]
  links:
    - target: infra-engine-pipeline
      type: implements
---
# 어댑터 계층 — qa-sdk 연동 + 범용 확장

## 목적 ^purpose

인프라 엔진 코어(범용)와 qa-sdk 체계(registry, ingest, gate, service-profile, 좌표계) 사이의 경계를 어댑터 인터페이스로 정의한다. 모든 외부 I/O와 qa-sdk 타입 변환을 어댑터가 흡수하여, 기존 시스템의 변화에 유연하게 대응한다.

## 방법 ^method

각 어댑터는 인터페이스(포트)와 구현(어댑터)으로 분리한다. 코어는 인터페이스만 참조하고, qa-sdk 구현은 `adapters/` 디렉토리에 격리한다. 변화 대응: 기존 API가 바뀌면 어댑터 구현만 교체, 코어 코드 수정 없음.

---

## 어댑터 인터페이스 (6개 포트)

### 1. RegistryAdapter — 배포 동기화

```typescript
interface RegistryAdapter {
  /**
   * 배포 정보를 레지스트리에 동기화
   * qa-sdk 구현: POST /api/services/:id/deployments/sync?catalog=
   */
  syncDeployment(params: DeploymentSyncParams): Promise<DeploymentSyncResult>;
}

interface DeploymentSyncParams {
  serviceId: string;
  deploymentVersion: string;   // git sha 또는 semver
  runtime: {
    namespace: string;
    name: string;
    env: string;
    region: string;
  };
  provider: string;
  project: string;             // Pulumi project name
  stack: string;               // Pulumi stack name
  resourceKey: string;         // 프로바이더 리소스 ID
  url?: string;                // endpoint URL
  urn?: string;                // Pulumi URN
  outputs?: Record<string, unknown>;
  catalogId?: string;          // 기본: "demo"
}

interface DeploymentSyncResult {
  synced: boolean;
  manifestImpact?: string;
}
```

### 2. ServiceProfileAdapter — service-profile URL 관리

```typescript
interface ServiceProfileAdapter {
  /** 서비스 URL 조회 */
  get(serviceId: string): Promise<string | null>;
  /** 서비스 URL 업데이트 (기존 값을 rollback 파일에 백업) */
  set(serviceId: string, url: string): Promise<void>;
  /** rollback 파일에서 이전 URL 복원 */
  restore(serviceId: string): Promise<void>;
}
```

### 3. InfraProfileAdapter — 인프라 확장 메타데이터

```typescript
interface InfraProfileAdapter {
  /** 배포 정보 기록 */
  setDeployment(serviceId: string, entry: InfraDeploymentEntry): Promise<void>;
  /** 배포 정보 조회 */
  getDeployment(serviceId: string): Promise<InfraDeploymentEntry | null>;
  /** 전체 배포 목록 */
  getAllDeployments(): Promise<Record<string, InfraDeploymentEntry>>;
  /** rollback 파일에서 이전 값 복원 */
  restore(serviceId: string): Promise<void>;
  /** 모니터 대상 등록 */
  setMonitor(serviceId: string, target: MonitorTarget): Promise<void>;
  /** 모니터 대상 제거 */
  removeMonitor(serviceId: string): Promise<void>;
  /** 전체 모니터 대상 */
  getAllMonitors(): Promise<MonitorTarget[]>;
  /** 모니터 상태 업데이트 */
  updateMonitorStatus(serviceId: string, status: string, checkedAt: string): Promise<void>;
}
```

### 4. IngestAdapter — 이벤트 전송

```typescript
interface IngestAdapter {
  /**
   * TransmissionEnvelope을 구성하여 ingest-server로 전송
   * @param eventKey - "deploy_event" | "health_event" 등
   * @param payload - 이벤트 페이로드
   * @param addressContext - 좌표 인코딩 결과 (빈 객체 허용)
   * @returns ok + error 사유 (fail-open: 호출자가 경고만 기록)
   */
  emit(
    eventKey: string,
    payload: Record<string, unknown>,
    addressContext: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string }>;
}
```

### 5. CoordinateAdapter — 좌표 해석

```typescript
interface CoordinateAdapter {
  /**
   * serviceId + env + region → svc_ref 좌표 해석
   * @returns "service:v1:{address}" 또는 null (해석 실패)
   */
  resolveSvcRef(serviceId: string, env: string, region: string, namespace?: string): string | null;

  /**
   * deploy_event address_context 인코딩
   * svc_ref가 null이면 빈 객체 반환 (fail-open)
   */
  encodeDeployEvent(svcRef: string | null, action: string, actor?: string): Record<string, string>;

  /**
   * health_event address_context 인코딩
   */
  encodeHealthEvent(svcRef: string | null, status: string): Record<string, string>;
}
```

### 6. GateAdapter — 품질 게이트 판정

```typescript
interface GateAdapter {
  /** 게이트 검사 결과 → 종합 판정 */
  evaluate(checks: GateCheckResult[]): GateVerdict;
}

type GateVerdict = "pass" | "warn" | "fail";
```

## qa-sdk 구현

### QaSdkRegistryAdapter (= createRegistryAdapter)

팩토리: `createRegistryAdapter(baseUrl: string): RegistryAdapter`

- `POST /api/services/:id/deployments/sync?catalog={catalogId}` 호출
- 기존 `DeploymentBinding` 타입 그대로 사용 — 타입 변환 이 어댑터가 담당
- timeout: 5초 (`AbortSignal.timeout(5_000)`)
- 에러: HTTP 비정상 응답 시 상태코드 + 본문 포함한 Error throw

### QaSdkServiceProfileAdapter

- `~/.qa-sdk/service-profile.json` 읽기/쓰기
- `services[serviceId]`는 **문자열(URL)** — 기존 `getServiceUrl()` 호환 완전 보장
- rollback: `set()` 호출 전 이전 값을 `~/.qa-sdk/service-profile.rollback.json`에 기록
- `restore()`: rollback 파일에서 이전 URL 복원 (크래시 안전)

### QaSdkInfraProfileAdapter

- `~/.qa-sdk/infra-profile.json` — 인프라 엔진 전용 파일 (service-profile과 독립)
- `deployments` + `monitors` 두 영역 관리
- rollback: `setDeployment()` 전 이전 값을 `~/.qa-sdk/infra-profile.rollback.json`에 기록

### QaSdkIngestAdapter

- `POST /v1/ingest` → 정규 `TransmissionEnvelope` 구성
- TransmissionEnvelope 필수 필드: transmission_id, sent_at, owner, source, runtime, build, records[]
- EventRecord 필수 필드: log_id, timestamp, record_kind, trace_id, span_id, event_key, event_version("001"), payload_format("json"), payload_encoding("raw"), payload_masking_applied, payload_masked_fields
- timeout: 5초
- fail-open: 실패 시 `{ ok: false, error: "..." }` 반환, 예외 던지지 않음

### QaSdkCoordinateAdapter

- `demo-catalog`의 service prefix 좌표 체계 사용
- svc_ref 해석: `serviceId` → `_INFRA_SVC` 매핑 → service prefix 인코딩
  - service prefix 4차원: env × region × svc_name × namespace
  - `_INFRA_SVC`에 없는 serviceId → null 반환 (fail-open)
- deploy_event 인코딩: svc_ref × deploy_action × actor → 정수 주소 → `"deploy_event:v1:{address}"`
- health_event 인코딩: svc_ref × health_status → 정수 주소 → `"health_event:v1:{address}"`

### QaSdkGateAdapter

- GateEngine의 판정 로직 경량 재구현
- 필수 게이트 전부 pass → "pass"
- 필수 pass + 선택 fail → "warn"
- 필수 fail → "fail"

### createPulumiDeployFn — Pulumi Automation API 기반 배포 함수

팩토리: `createPulumiDeployFn(options?: PulumiDeployOptions)` → `deployFn(provider, config, serviceId, stackName)`

- 로컬 파일 백엔드 사용 (`file://~/.pulumi-local`) — S3 불필요
- K8s context를 `k3d-qa-local`로 설정
- 배포 후 K3s NodePort에 대해 `kubectl port-forward`를 백그라운드로 실행하여 호스트에서 접근 가능하게 함
- 환경별 포트 오프셋: dev→+20000, stage→+21000, prod→+22000

### LocalProviderOptions

```typescript
interface LocalProviderOptions {
  env?: string;              // 배포 대상 환경 (namespace 결정용)
  imageOverride?: string;    // 이미지 오버라이드 (기본: qa-sdk/{serviceId}:latest)
  healthPath?: string;       // 헬스체크 경로 (기본: /health/live)
}
```

`createLocalProvider(options?)` 팩토리로 Local 프로바이더 생성 시 전달한다.

## 어댑터별 에러 처리

| 어댑터 | timeout | 재시도 | 실패 동작 |
|--------|---------|--------|----------|
| RegistryAdapter | 5초 | 1회 | throw (파이프라인 중단) |
| ServiceProfileAdapter | — (로컬 I/O) | 없음 | throw |
| InfraProfileAdapter | — (로컬 I/O) | 없음 | throw |
| IngestAdapter | 5초 | 없음 | `{ ok: false }` (fail-open) |
| CoordinateAdapter | — (인메모리) | 없음 | null 반환 (fail-open) |
| GateAdapter | — (인메모리) | 없음 | throw |

## 데이터 추출 패턴

qa-sdk 데이터 구조에서 인프라 엔진이 필요한 정보를 추출하는 헬퍼:

```typescript
/** ProvisionResult → DeploymentSyncParams 변환 */
function toDeploymentSyncParams(ctx: DeployContext): DeploymentSyncParams;

/** VerifyResult healthStatus → health_status 축 값 변환 */
function mapHealthStatus(status: "healthy" | "degraded" | "failed"): "healthy" | "degraded" | "unhealthy";
// "failed" → "unhealthy" (health_status 축 v1 엔트리에 맞춤)

/** DKG에서 서비스 의존 관계 추출 */
function extractDependencyGraph(dkgData: unknown): DependencyEdge[];
```

## 소비 ^consumes

- `registry-service` HTTP API (`/api/services/:id/deployments/sync`)
- `ingest-server` HTTP API (`POST /v1/ingest`)
- `~/.qa-sdk/service-profile.json` (URL 문자열만)
- `~/.qa-sdk/infra-profile.json` (인프라 확장 메타데이터)
- `demo-catalog` — service, deploy_event, health_event prefix 좌표 체계
- qa-sdk 타입: `DeploymentBinding`, `TransmissionEnvelope`, `EventRecord`

## 확장

다른 프로젝트에서 인프라 엔진을 사용할 때:
1. 6개 어댑터 인터페이스의 대체 구현을 작성
2. 파이프라인 생성 시 주입 (`createPipeline({ adapters: { registry, ingest, ... } })`)
3. 코어 코드 수정 없음
