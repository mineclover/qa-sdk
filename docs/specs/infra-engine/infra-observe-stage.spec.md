---
def:
  id: infra-observe-stage
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
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

- **배포 이벤트 emit**: 파이프라인 결과를 `deploy_event` prefix로 ingest-server에 전송
- **모니터링 등록**: sync-loop 대상 목록에 배포된 서비스 추가
- **fail-open**: 관측 실패가 배포 성공을 뒤집지 않음 — 경고만 기록
- **어댑터 기반**: ingest-server 연동은 IngestAdapter를 통해

---

## 배포 이벤트 구조

qa-sdk의 기존 `deploy_event` prefix를 활용하여 배포 이벤트를 emit한다.

```typescript
interface DeployEventPayload {
  service_id: string;
  provider: string;
  env: string;
  region: string;
  endpoint: string;
  health_status: "healthy" | "degraded" | "failed";
  gate_verdict: "pass" | "warn" | "fail";
  duration_ms: number;
  stage_results: StageResult[];  // pipeline.spec의 StageResult 타입 재사용
  version?: string;
  triggered_by: "ci" | "manual";    // GitHub Actions vs CLI
  rollback: boolean;                 // rollback이 발생했는지
}
```

### 이벤트 흐름

```
DeployResult
  → IngestAdapter.emit(deploy_event, payload)
    → POST /v1/ingest (ingest-server)
      → DKG 관측 체계에 편입
        → 대시보드에서 배포 이력/상태 조회 가능
```

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
  interval: number;          // 헬스체크 주기 (초). 기본 60
  lastChecked?: string;      // ISO-8601
  lastStatus?: "healthy" | "degraded" | "unreachable";
}
```

sync-loop가 주기적으로 모든 MonitorTarget에 헬스체크를 수행하고, 상태 변화 시 이벤트를 emit한다. 상세: [infra-monitoring.spec.md](infra-monitoring.spec.md)

## 정의 ^defines

### ObserveResult

```typescript
interface ObserveResult {
  eventEmitted: boolean;
  monitorRegistered: boolean;
  warnings: string[];        // fail-open 시 경고 메시지
}
```

### IngestAdapter

```typescript
interface IngestAdapter {
  /** 배포 이벤트를 ingest-server로 전송 */
  emit(eventKey: string, payload: Record<string, unknown>): Promise<boolean>;
}
```

## 실행 흐름

```
VerifyResult (healthStatus, gateVerdict, checks)
  │
  ├─ 1. 배포 이벤트 생성
  │     DeployResult → DeployEventPayload 변환
  │
  ├─ 2. ingest-server emit (fail-open)
  │     IngestAdapter.emit("deploy_event", payload)
  │     실패 시 → warnings에 기록, 파이프라인 성공 유지
  │
  └─ 3. 모니터링 등록 (fail-open)
        MonitorTarget 생성 → sync-loop 대상에 추가
        실패 시 → warnings에 기록
```

## 소비 ^consumes

- `IngestAdapter` — ingest-server HTTP 호출
- `DeployResult` — 파이프라인 전체 결과
- `deploy_event` prefix — qa-sdk event-catalog 정의

## fail-open 보장

ObserveStage의 모든 외부 호출은 try-catch로 감싸며, 실패 시:
1. `ObserveResult.warnings`에 실패 사유 기록
2. `ObserveResult.eventEmitted = false` / `monitorRegistered = false` 설정
3. 파이프라인은 계속 진행 — DeployResult.success는 VerifyStage까지의 결과로 결정
