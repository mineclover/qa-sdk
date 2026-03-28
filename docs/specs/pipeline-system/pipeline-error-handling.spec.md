---
def:
  id: pipeline-error-handling
  address: def_document:v1:2137
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [observability, tier-infra]
  links:
    - target: pipeline-enrichment
      type: constrains
    - target: pipeline-metric-agg
      type: constrains
---
# 파이프라인 에러 처리

## 목적 ^purpose

Phase 1/2 파이프라인의 에러 처리 정책. Phase 1 실패 시 DLQ 격리, Phase 2 실패 시 재시도 큐, 포이즌 메시지 격리 규칙.

## 구성 ^overview

에러 처리는 3계층으로 구성된다.

1. **HTTP 에러 핸들러** — Hono 미들웨어에서 AppError/ZodError/미처리 예외 분류
2. **Phase 2 재시도 큐** — TaskQueue 기반 재시도 + 백오프
3. **DLQ (Dead Letter Queue)** — 복구 불가능한 메시지 격리 + 수동 재시도 API

## HTTP 에러 핸들러

소스: `packages/ingest-server/src/middleware/error-handler.ts`

`createErrorHandler(logger)` 가 반환하는 Hono ErrorHandler가 모든 라우트 에러를 처리한다.

| 에러 타입 | 응답 코드 | 응답 본문 |
|-----------|-----------|-----------|
| `AppError` | `err.statusCode` (400/404/500) | `{ error: { code, message } }` |
| `ZodError` | 400 | `{ error: { code: "INVALID_INPUT", message: "path: issue; ..." } }` |
| 기타 | 500 | `{ error: { code: "INTERNAL_ERROR", message: "internal server error" } }` |

미처리 예외는 `requestId`와 함께 error 레벨로 로깅된다.

## 에러 코드 체계

소스: `packages/ingest-server/src/lib/errors.ts`

| 코드 | HTTP | 팩토리 함수 |
|------|------|-------------|
| `INVALID_INPUT` | 400 | `badRequest(message)` |
| `TRACE_NOT_FOUND` | 404 | `traceNotFound(traceId)` |
| `GRAPH_NOT_FOUND` | 404 | `graphNotFound(traceId)` |
| `SESSION_NOT_FOUND` | 404 | `sessionNotFound(sessionId)` |
| `SCENARIO_NOT_FOUND` | 404 | `scenarioNotFound(scenarioId)` |
| `INTERNAL_ERROR` | 500 | (미처리 예외에서 자동) |

## Phase 2 재시도 정책

소스: `packages/ingest-server/src/lib/phase-two-worker.ts`

### 재시도 설정

```typescript
const PHASE_TWO_TASK_QUEUE_OPTIONS = {
  retryAttempts: 2,
  retryDelayMs: 1_000,
} as const;
```

- 최대 2회 재시도 (총 3회 시도)
- 재시도 간격: 1초 고정 백오프
- `InMemoryTaskQueue`가 `runWithRetry()`에서 재시도 로직을 실행

### 실패 전파

- reconstruction 실패: `reconstructPendingTraces()`의 `onError` 콜백에서 로깅
- verdict 실패: `computePendingVerdicts()`의 `onError` 콜백에서 로깅
- 재시도 소진 후: 에러가 TaskQueue로 전파 → DLQ에 captureFailuresInDlq 옵션에 따라 격리

### 에러 격리 원칙

| 단계 | 실패 시 영향 |
|------|-------------|
| reconstruction | verdict 계산 건너뜀 (해당 trace만) |
| verdict | reconstruction 결과는 유지 |
| metric aggregation | reconstruction과 독립적으로 실행 |
| convergence 알림 | try-catch 격리, Phase 2 verdict에 영향 없음 |
| transition matching (Phase 2.5) | try-catch 격리, verdict에 영향 없음 |

## DLQ 관리 API

소스: `packages/ingest-server/src/routes/dlq.ts`

### `GET /v1/admin/dlq`

- 파라미터: `status=pending` (현재 pending만 지원), `limit` (최대 200, 기본 50)
- 응답: `{ items: [{ id, traceId, phase, errorMessage, attemptCount, ... }] }`

### `POST /v1/admin/dlq/retry`

- pending 상태 DLQ 항목을 최대 100건 조회
- `attemptCount >= maxRetryAttempts` (기본 3)이면 skip (포이즌 메시지)
- 각 항목: `markAttempted()` → phase에 따라 reconstruction/verdict 재실행 → 성공 시 `markResolved()`
- 응답: `{ total, resolved: [...], failed: [...], skipped: [...] }`

### 포이즌 메시지 처리

- `maxRetryAttempts` (기본 3) 초과한 DLQ 항목은 retry에서 skip
- skip된 항목은 warn 로그에 `dlqId`, `traceId`, `phase`, `attemptCount` 포함
- 수동 개입이 필요한 상태로 남음

## Registry 검증 실패

소스: `packages/ingest-server/src/routes/ingest.ts`

| 모드 | 동작 |
|------|------|
| `off` | 검증 안 함 |
| `warn` (기본) | 미등록 이벤트 warn 로그 + `registryWarning` 필드에 사유 기록. 저장은 계속 |
| `strict` | `badRequest()` 에러 → 400 응답. 전체 envelope 거부 |

Registry 자체 호출 실패 시: **fail-open** — `{ valid: true }` 반환하고 warn 로그 발행.
