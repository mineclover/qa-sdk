---
def:
  tier: component
  id: ingest-admin-operations
  address: def_document:v2:275585
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [runtime, observability, performance]
  links:
    - target: admin-api-system
      type: refines
sources:
  - packages/ingest-server/src/server.ts
  - packages/ingest-server/src/app.ts
  - packages/ingest-server/src/routes/dlq.ts
  - packages/ingest-server/src/routes/cleanup.ts
  - packages/ingest-server/src/lib/phase-two-worker.ts
  - packages/ingest-server/src/lib/cleanup.ts
  - packages/ingest-server/src/lib/bullmq-task-queue.ts
  - packages/core/src/ports/dlq-store.port.ts
  - packages/ingest-server/src/routes/dlq.test.ts
  - packages/ingest-server/src/routes/cleanup.test.ts
  - packages/ingest-server/src/app.test.ts
  - packages/ingest-server/src/async-worker.e2e.test.ts
---

# Ingest Admin 운영 규칙

## 목적 ^purpose

DLQ 삽입 시점, cleanup 실행 경계, 설정, 의존 포트를 분리해 ingest admin 운영 작업이 본선 수집 경로를 침범하지 않도록 규정한다.

## 구성 ^overview

- **DLQ 삽입 시점** — Phase 2 (reconstruction/verdict) 최종 실패 시 자동 삽입.
- **재시도 한도** — `DLQ_MAX_RETRY_ATTEMPTS` (기본 3)로 무한 재시도 방지.
- **BullMQ 통합** — `TASK_QUEUE_ENABLED=true` 시 Phase 2 작업을 Redis 큐에 위임.
- **Cleanup 실행** — `POST /v1/admin/cleanup`과 cleanup scheduler가 같은 `cleanupExpiredData()`를 사용.
- **admin/ingest 경로 분리** — ingest rate-limit은 `/v1/ingest` POST에만 적용되고 `/v1/admin/*`에는 적용되지 않는다.

## DLQ 삽입 규칙

### 자동 삽입 (본선 경로)

BullMQ 태스크 큐의 `onFinalFailure` 콜백에서 DLQ에 기록한다:

```
Phase 2 enqueue → BullMQ 처리 → retryAttempts(2) 소진 → onFinalFailure
  → dlqStore.insert({ id: newDlqId(), traceId, phase, errorMessage })
```

- `phase`: `"reconstruction"` 또는 `"verdict"`
- DLQ 삽입은 동기 응답 경로에 영향 없음 (Phase 2는 비동기)

### 수동 재시도 (admin 경로)

`POST /v1/admin/dlq/retry`에서 운영자가 명시적으로 재시도:

1. `markAttempted(id)` — attemptCount 증가, lastAttemptedAt 갱신
2. phase별 재처리 실행
3. 성공 시 `markResolved(id)` — resolvedAt 기록
4. 실패 시 에러 로그만 기록 (DLQ에 남아있음)

## 설정 항목

| 설정 | 환경변수 | 기본값 | 설명 |
|------|---------|--------|------|
| 재시도 한도 | `DLQ_MAX_RETRY_ATTEMPTS` | 3 | admin retry 시 최대 시도 횟수 |
| 태스크 큐 활성화 | `TASK_QUEUE_ENABLED` | false | BullMQ 사용 여부 |
| Redis URL | `REDIS_URL` | - | BullMQ 연결 URL (태스크 큐 필수) |
| 워커 동시성 | `WORKER_CONCURRENCY` | 5 | BullMQ 워커 동시 처리 수 |

## Phase 2 태스크 큐 동작

```
storeEnvelope (Phase 1, 동기)
  → enqueuePhaseTwoTasks (비동기)
    → BullMQ queue: "ingest-phase-two"
    → retryAttempts: 2, retryDelayMs: 1000
    → worker: reconstructPendingTraces → computePendingVerdicts
    → 최종 실패 시 → DLQ 삽입
```

- `TASK_QUEUE_ENABLED=false` (기본) → Phase 2를 인라인으로 동기 실행 (`processPendingPhaseTwo`)
- `TASK_QUEUE_ENABLED=true` → BullMQ로 비동기 위임, 별도 worker 프로세스 가능

## Cleanup 운영 규칙

`POST /v1/admin/cleanup`은 scheduler 없이 운영자가 즉시 정리를 요청하는 경로다.

- 기본 보존 기간: trace 30일, verdict 90일
- 기본 batch size: 1000
- 정리 대상: expired verdict report, expired trace 하위 event record/runtime graph/verdict report/trace, orphan QA session
- 실행 결과는 `options`, `cutoffs`, `deleted` 집계로 반환
- 스케줄러(`CLEANUP_CRON_ENABLED=true`)와 admin endpoint 모두 `cleanupExpiredData()`를 공유해 동작 차이를 줄인다.

## Worker 모드

`ingest-server worker` 인자로 시작하면 HTTP 서버 없이 BullMQ 워커만 실행:

- `TASK_QUEUE_ENABLED=true` + `REDIS_URL` 필수
- TransitionEngine 선택적 초기화
- `installWorkerShutdown`으로 종료 처리

## 의존 포트 경계

| 영역 | 포트 | 설명 |
|------|------|------|
| DLQ 저장소 | `DlqStore` | insert, findPending, markAttempted, markResolved |
| trace 재구성 | `RecordStore`, `TraceStore`, `GraphStore` | Phase 2 reconstruction |
| session 연관 | `SessionStore`, `ScenarioSpecStore` | verdict 계산 |
| verdict 저장 | `VerdictStore` | 판정 결과 영속 |
| 태스크 큐 | `BullMQTaskQueue` | Phase 2 비동기 위임 |
| 데이터 정리 | `CleanupStore` | 만료 trace/verdict/session 삭제 |
