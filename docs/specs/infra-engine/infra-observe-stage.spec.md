---
def:
  id: infra-observe-stage
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: implemented
  layer: operation
  tags: [infra, observability, ingest]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-verify-stage
      type: depends_on
---
# ObserveStage — 배포 이벤트 emit + 모니터링 등록

## 목적 ^purpose

배포 결과를 qa-sdk의 관측 체계(ingest-server)로 emit하고, ArgoCD 스타일 모니터링 sync-loop에 등록하여 배포 후 지속적인 상태 감시를 가능하게 한다.

## 구성 ^overview

- **TransmissionEnvelope 구성**: 파이프라인 결과를 `deploy_event` prefix 좌표로 인코딩하여 정규 `TransmissionEnvelope` 생성
- **좌표 해석 어댑터**: `CoordinateAdapter`가 serviceId → svc_ref 정수 좌표 변환 담당
- **모니터링 등록**: sync-loop 대상 목록에 배포된 서비스 추가
- **fail-open**: 관측 실패가 배포 성공을 뒤집지 않음 — 경고만 기록
- **어댑터 기반**: 좌표 해석, envelope 구성, ingest 전송 모두 어댑터를 통해

---

## 배포 이벤트 — deploy_event prefix 좌표 인코딩

### deploy_event prefix 구조 (demo-catalog 기준)

```
deploy_event (3차원)
  ├── svc_ref: prefix_ref → service (env × region × svc_name × namespace)
  ├── deploy_action: axis (deploy, rollback, scale_up, ...)
  └── actor: table_ref → members
```

### 좌표 해석 흐름

```
DeployContext (serviceId, env, region, provider)
  │
  ├─ 1. svc_ref 해석
  │     CoordinateAdapter.resolveSvcRef(serviceId, env, region)
  │     → service prefix 좌표 인코딩 → 정수 주소
  │     → "service:v1:{address}" 문자열
  │     실패 시 → address_context 없이 진행 (fail-open)
  │
  ├─ 2. deploy_action 결정
  │     ctx.verification.healthStatus === "failed" → "rollback"
  │     그 외 → "deploy"
  │
  └─ 3. address_context 조립
        { "deploy_event": "deploy_event:v1:{encoded_address}" }
```

### TransmissionEnvelope 구성

```typescript
// IngestAdapter가 구성하는 정규 envelope
const envelope: TransmissionEnvelope = {
  transmission_id: ulid(),
  sent_at: new Date().toISOString(),
  owner: {
    owner_type: "agent",
    owner_id: "infra-engine",
  },
  source: {
    service_name: "infra-engine",
    sdk_name: "infra-engine",
    sdk_version: "1.0.0",
  },
  runtime: {
    platform: "node",
  },
  build: {
    env: ctx.env,                    // "dev" | "staging" | "prod"
    release_version: ctx.provision?.outputs.version,
  },
  records: [{
    log_id: ulid(),
    timestamp: new Date().toISOString(),
    record_kind: "log",
    trace_id: ulid(),                // 배포 파이프라인 실행 ID
    span_id: ulid(),
    event_key: "deploy_event",
    event_version: "001",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: deployEventPayload,     // 아래 정의
    address_context: addressContext,  // svc_ref 해석 결과 (실패 시 빈 객체)
  }],
};
```

### DeployEventPayload (payload 필드)

```typescript
interface DeployEventPayload {
  service_id: string;
  provider: string;
  env: string;
  region: string;
  endpoint: string;
  health_status: "healthy" | "degraded" | "unhealthy";  // 축 값과 일치
  gate_verdict: "pass" | "warn" | "fail";
  duration_ms: number;
  stage_results: StageResult[];   // pipeline.spec의 StageResult 타입 재사용
  version?: string;
  triggered_by: "ci" | "manual";
  rollback: boolean;
  stack_name: string;
}
```

**health_status 축 매핑**: VerifyStage의 `"failed"` → ObserveStage에서 `"unhealthy"`로 변환 (health_status 축 v1 엔트리: healthy, degraded, unhealthy, maintenance)

### health_event emit (모니터링 상태 변화 시)

sync-loop가 상태 변화를 감지하면 `health_event` prefix로 emit:

```
health_event (2차원)
  ├── svc_ref: prefix_ref → service
  └── health_status: axis (healthy, degraded, unhealthy, maintenance)
```

동일한 `CoordinateAdapter.resolveSvcRef()` + TransmissionEnvelope 패턴 사용.

## 모니터링 등록

배포 성공 시, sync-loop 감시 대상에 추가:

```typescript
interface MonitorTarget {
  serviceId: string;
  endpoint: string;
  healthPath: string;
  provider: string;
  env: string;
  region: string;
  namespace: string;             // svc_ref 해석에 필요
  interval: number;              // 헬스체크 주기 (초). 기본 60
  lastChecked?: string;          // ISO-8601
  lastStatus?: "Synced" | "OutOfSync" | "Degraded" | "Unknown";
}
```

저장 위치: `~/.qa-sdk/infra-profile.json`의 `monitors` 필드 (infra-profile과 통합)

sync-loop가 주기적으로 모든 MonitorTarget에 헬스체크를 수행하고, 상태 변화 시 `health_event`를 emit한다. 상세: [infra-monitoring.spec.md](infra-monitoring.spec.md)

## 정의 ^defines

### ObserveResult

```typescript
interface ObserveResult {
  eventEmitted: boolean;
  monitorRegistered: boolean;
  warnings: string[];            // fail-open 시 경고 메시지 (사유 포함)
}
```

### CoordinateAdapter

```typescript
interface CoordinateAdapter {
  /**
   * serviceId + env + region → svc_ref 좌표 문자열 해석
   * @returns "service:v1:{address}" 또는 null (해석 실패)
   */
  resolveSvcRef(serviceId: string, env: string, region: string, namespace?: string): string | null;

  /**
   * deploy_event 전체 좌표 인코딩
   * @returns address_context Record 또는 빈 객체 (해석 실패)
   */
  encodeDeployEvent(svcRef: string, action: string, actor?: string): Record<string, string>;

  /**
   * health_event 전체 좌표 인코딩
   */
  encodeHealthEvent(svcRef: string, status: string): Record<string, string>;
}
```

### IngestAdapter

```typescript
interface IngestAdapter {
  /**
   * TransmissionEnvelope을 구성하여 ingest-server로 전송
   * @returns ok=true 성공, ok=false + error 사유
   */
  emit(eventKey: string, payload: Record<string, unknown>, addressContext: Record<string, string>): Promise<{ ok: boolean; error?: string }>;
}
```

## 실행 흐름

```
VerifyResult (healthStatus, gateVerdict, checks)
  │
  ├─ 1. 좌표 해석 (fail-open)
  │     CoordinateAdapter.resolveSvcRef(serviceId, env, region)
  │     → svcRef 문자열 (실패 시 null → address_context 빈 객체)
  │     CoordinateAdapter.encodeDeployEvent(svcRef, action, actor)
  │     → addressContext
  │
  ├─ 2. TransmissionEnvelope 구성 + ingest emit (fail-open)
  │     IngestAdapter.emit("deploy_event", payload, addressContext)
  │     실패 시 → warnings에 error 메시지 기록
  │
  └─ 3. 모니터링 등록 (fail-open)
        MonitorTarget 생성 → infra-profile.json monitors에 추가
        실패 시 → warnings에 기록
```

## 소비 ^consumes

- `CoordinateAdapter` — svc_ref 좌표 해석 + prefix 인코딩
- `IngestAdapter` — TransmissionEnvelope 구성 + ingest-server HTTP 전송
- `MonitorAdapter` — 감시 대상 등록
- `DeployResult` — 파이프라인 전체 결과
- `deploy_event` prefix — demo-catalog (svc_ref × deploy_action × actor)
- `health_event` prefix — demo-catalog (svc_ref × health_status)

## fail-open 보장

ObserveStage의 모든 외부 호출은 try-catch로 감싸며, 실패 시:
1. `ObserveResult.warnings`에 실패 사유 문자열 기록
2. `ObserveResult.eventEmitted = false` / `monitorRegistered = false` 설정
3. 파이프라인은 계속 진행 — DeployResult.success는 VerifyStage까지의 결과로 결정
4. svc_ref 해석 실패 시 → `address_context` 빈 객체로 emit (좌표 없는 이벤트도 수집 가능)
