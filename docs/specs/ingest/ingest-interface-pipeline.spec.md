---
def:
  id: ingest-interface-pipeline
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [tier-infra]
  links:
    - target: ingest-api-spec
      type: refines
    - target: ingest-pipeline-flow
      type: refines
---

# Ingest 인터페이스 파이프라인

## 목적 ^purpose

ingest API가 registry validation, trace transaction, DLQ 삽입과 어떻게 연결되는지 후속 처리 경로를 분리해 설명한다.

## 구성 ^overview

- **Phase 1 (동기 응답 경로)** — envelope 수신 → 검증 → 저장 → SSE 발행 → 202 응답.
- **Phase 2 (비동기 후처리)** — reconstruction → verdict 계산 → convergence 통지.
- **DLQ fallback** — Phase 2 최종 실패 시 DLQ에 삽입하여 수동 재처리 경로 보존.
- **Convergence Pipeline** — Phase 2 완료 후 집계/관측 파이프라인에 통지.

## 전체 파이프라인 흐름

```
POST /v1/ingest
  │
  ├─ deserialize (Content-Type 감지)
  ├─ zod schema 검증
  ├─ enrichAddressContext (infra_context 머지)
  ├─ checkAddressHealth (orphan/stale 경고)
  ├─ registry validation (strict/warn/off)
  │
  ├─ Phase 1: storeEnvelope
  │   ├─ transmissionStore.insert (전송 메타)
  │   ├─ trace별 그룹핑
  │   ├─ 각 trace:
  │   │   ├─ withTraceTransaction (session + trace + record 저장)
  │   │   ├─ recordStreamBroker.publish (SSE)
  │   │   └─ debugStore.append (선택)
  │   └─ 202 응답
  │
  └─ Phase 2: processEnvelope (비동기)
      ├─ TASK_QUEUE_ENABLED=true:
      │   └─ BullMQ enqueue → worker가 처리
      └─ TASK_QUEUE_ENABLED=false:
          └─ processPendingPhaseTwo (인라인)
              ├─ reconstructPendingTraces
              ├─ computePendingVerdicts
              ├─ aggregateMetrics (MetricRollupStore)
              ├─ decodeAddressContext (decode-service 호출)
              ├─ transition processing (선택)
              └─ convergencePipeline.notifyCompletion
```

## Registry Validation (첫 관문)

수신 직후 schema drift를 방지하는 첫 번째 검증 단계:

| 모드 | 동작 | 응답 영향 |
|------|------|----------|
| `strict` | 미등록 이벤트 → 400 에러 | envelope 전체 거부 |
| `warn` (기본) | 미등록 이벤트 → warning 로그 + registryWarning 기록 | 저장 진행 |
| `off` | 검증 생략 | 무조건 저장 |

- `RegistryClient`가 registry-service에 `validateEvent()` 호출
- registry 불가용 시 fail-open (유효하다고 간주)
- envelope 내 고유 eventKey+eventVersion 조합만 질의 (중복 방지)

## Trace Transaction (Phase 1 핵심)

record 저장과 trace/session 갱신이 같은 단위로 묶여야 하는 구간:

1. envelope.records를 `trace_id`별로 그룹핑
2. 각 trace 그룹에 대해:
   - `withTraceTransaction` 설정 시: Drizzle 트랜잭션으로 session + trace + record 원자적 저장
   - 미설정 시: 각 store에 개별 호출 (InMemory)
3. 저장 성공 후 SSE/WebSocket 발행
4. scenario 구독자가 있으면 session의 scenarioId로 scenario 레벨 broadcast

## DLQ 삽입 (최종 fallback)

Phase 2 실패 시 동기 응답을 깨지 않으면서 실패 배치를 보존:

```
BullMQ worker → retryAttempts(2) 소진 → onFinalFailure
  → dlqStore.insert({ id: newDlqId(), traceId, phase, errorMessage })
  → logger.error("recorded failed phase-two job in dlq")
```

- Phase 1 (저장)은 이미 성공 → 202 응답은 보장됨
- DLQ 항목은 `POST /v1/admin/dlq/retry`로 수동 재처리

## Convergence 연결

Phase 2 완료 후:

```
convergencePipeline.notifyCompletion(traceIds)
  → record 임계치 도달 시 자동 flush
  → aggregateUsageData → collectMetrics → metricsToObservations
  → 패턴 분류 (PATTERN_CLASSIFICATION_ENABLED 시)
```

- `CONVERGENCE_ENABLED=true` 시 활성화
- 스케줄러: `CONVERGENCE_SCHEDULE_INTERVAL_MS` (기본 5분) 주기 자동 flush
- record 임계치: `CONVERGENCE_RECORD_THRESHOLD` (기본 100건)
