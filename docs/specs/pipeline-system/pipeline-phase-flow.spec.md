---
def:
  tier: component
  id: pipeline-phase-flow
  address: def_document:v2:137356
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [runtime, observability, performance]
  links:
    - target: ingest-interface-pipeline
      type: refines
    - target: ingest-admin-operations
      type: depends_on
  sources:
    - packages/ingest-server/src/routes/ingest.ts
    - packages/ingest-server/src/routes/ingest.test.ts
    - packages/ingest-server/src/lib/phase-two-worker.ts
    - packages/ingest-server/src/lib/phase-two-worker.test.ts
    - packages/ingest-server/src/lib/in-memory-task-queue.ts
    - packages/ingest-server/src/lib/bullmq-task-queue.ts
    - packages/ingest-server/src/async-worker.e2e.test.ts
    - packages/ingest-server/src/lib/convergence-e2e.test.ts
---

# Pipeline Phase 흐름

## 목적 ^purpose

ingest 파이프라인의 Phase 1 (동기 저장) → Phase 2 (비동기 처리) → Phase 2.5 (Transition) 3단계 흐름과 각 단계의 입출력 경계를 정의한다.

## 구성 ^overview

- **Phase 1** — envelope 수신 → 저장 → SSE 발행 → 202 응답 (동기, 응답 경로).
- **Phase 2** — reconstruction → verdict 계산 → metric 집계 → decode (비동기).
- **Phase 2.5** — Transition Engine 처리 (선택적, `TRANSITION_ENGINE_ENABLED` 시).
- **Convergence** — Phase 2 완료 후 집계/관측 파이프라인에 통지.
- **DLQ** — Phase 2 최종 실패 시 dead letter queue에 보존.

## Phase 1: 동기 저장

**입력:** TransmissionEnvelope (검증 완료)
**출력:** persistedTraceIds (저장 성공한 trace ID 목록)

```
processEnvelope(envelope)
  → storeEnvelope(envelope)
    → transmissionStore.insert (전송 메타)
    → trace별 그룹핑 (trace_id 기준)
    → 각 trace:
        → persistTrace (session + trace + record, 트랜잭션)
        → recordStreamBroker.publish (실시간 SSE)
        → debugStore.append (디버그 히스토리)
        → scenario broadcast (session.scenarioId 있으면)
  → return persistedTraceIds
```

**보장:** Phase 1 성공 시 202 응답. trace 단위 격리 — 하나의 trace 실패가 다른 trace에 영향 없음.

## Phase 2: 비동기 처리

**입력:** persistedTraceIds
**실행 모드:**

| 모드 | 조건 | 동작 |
|------|------|------|
| 인라인 | `TASK_QUEUE_ENABLED=false` (기본) | `processPendingPhaseTwo(deps)` 동기 실행 |
| BullMQ | `TASK_QUEUE_ENABLED=true` | 각 traceId를 큐에 enqueue → worker가 처리 |

**처리 단계:**

```
Phase 2 (각 trace에 대해):
  1. reconstructPendingTraces → trace graph 재구성
  2. computePendingVerdicts  → scenario 기반 verdict 계산
  3. aggregateMetrics        → metric 롤업 (MetricRollupStore)
  4. decodeAddressContext    → decode-service 호출로 주소 디코딩
  5. convergencePipeline.notifyCompletion(traceIds)
```

**BullMQ 설정:**

| 항목 | 값 |
|------|-----|
| 큐 이름 | `ingest-phase-two` |
| 재시도 횟수 | 2 (`PHASE_TWO_TASK_QUEUE_OPTIONS.retryAttempts`) |
| 재시도 지연 | 1,000ms |
| 워커 동시성 | `WORKER_CONCURRENCY` (기본 5) |
| 최종 실패 | DLQ 삽입 |

## Phase 2.5: Transition Engine (선택적)

`TRANSITION_ENGINE_ENABLED=true` 시 활성화:

```
Phase 2.5:
  → transitionFns.processSession({ sessionId, events })
    → instances: 전이 인스턴스 목록
    → violations: 전이 위반 목록
    → unmatchedCount: 매칭되지 않은 이벤트 수
  → transitionFns.decodeCtx(catalog, encoded)
    → 인코딩된 주소 컨텍스트를 entity 이름으로 디코딩
```

- `TRANSITION_VIOLATION_MODE`: `strict` (에러) / `warn` (경고만)
- TransitionSpec은 `DEMO_TRANSITION_SPECS`에서 로드
- Worker 모드에서도 동일하게 동작

## DLQ 연계

```
Phase 2 최종 실패 경로:
  BullMQ retryAttempts 소진
    → onFinalFailure callback
    → dlqStore.insert({
        id: newDlqId(),
        traceId: task.traceId,
        phase: task.phase,        // "reconstruction" | "verdict"
        errorMessage: error.message
      })
```

- Phase 1 저장은 이미 완료 — 데이터 유실 없음
- DLQ 항목은 `/v1/admin/dlq`로 조회, `/v1/admin/dlq/retry`로 재시도

## Convergence 연계

Phase 2 완료 후 convergence 파이프라인에 통지:

```
convergencePipeline.notifyCompletion(traceIds)
  → 내부 카운터 누적
  → recordThreshold 도달 시 자동 flush:
    → aggregateUsageData(records)
    → collectMetrics(catalog, graph, usageData)
    → metricsToObservations(metrics)
    → classifyPattern (선택적)
```

- 스케줄 기반 주기적 flush도 병행 (`CONVERGENCE_SCHEDULE_INTERVAL_MS`)
- convergence 실패가 Phase 2 verdict를 차단하지 않음 (에러 격리)
