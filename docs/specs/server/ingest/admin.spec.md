---
def:
  id: admin-api-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
---
# Admin API

> 운영 관리용 내부 엔드포인트 — DLQ 조회/재시도, 만료 데이터 정리. ^purpose

## 상태

implemented

## 엔드포인트

### GET /v1/admin/dlq

처리 실패한 DLQ(Dead Letter Queue) 항목 조회.

요청 파라미터:

| 파라미터 | 타입 | 기본값 | 최대값 | 설명 |
|---|---|---|---|---|
| `status` | string | `"pending"` | - | 현재 `"pending"`만 지원 |
| `limit` | number | 50 | 200 | 조회 건수. 양의 정수여야 하며 0이면 400 |

응답 200:
```json
{
  "items": [
    {
      "id": "dlq_...",
      "traceId": "trc_...",
      "phase": "reconstruction" | "verdict",
      "errorMessage": "...",
      "attemptCount": 0,
      "lastAttemptedAt": "2026-03-12T10:00:00.000Z" | null,
      "createdAt": "2026-03-12T10:00:00.000Z",
      "resolvedAt": null
    }
  ]
}
```

### POST /v1/admin/dlq/retry

모든 pending DLQ 항목을 재시도한다 (최대 100건).

처리 흐름:
```
1. dlqStore.findPending(100)
2. 각 항목에 대해:
   - attemptCount >= maxRetryAttempts → skip (warn 로그)
   - dlqStore.markAttempted(id)
   - phase=reconstruction:
     - reconstructTrace(deps, traceId)
     - 성공 시 markResolved + computePendingVerdicts
   - phase=verdict:
     - computeTraceVerdict(deps, traceId, { force: true })
     - 성공 시 markResolved
   - 실패 시 failed에 추가 (error 로그)
3. 결과 반환
```

응답 200:
```json
{
  "total": 3,
  "resolved": ["dlq_001"],
  "failed": ["dlq_002"],
  "skipped": ["dlq_003"]
}
```

- `resolved`: 재시도 성공하여 해결된 항목 ID
- `failed`: 재시도했으나 다시 실패한 항목 ID
- `skipped`: maxRetryAttempts 초과로 건너뛴 항목 ID

### POST /v1/admin/cleanup

만료된 trace, verdict, orphan session을 배치 삭제. body는 선택적(빈 body 허용).

요청 body (선택):
```json
{
  "traceRetentionDays": 30,
  "verdictRetentionDays": 90,
  "batchSize": 1000
}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `traceRetentionDays` | number | 30 | trace 보존 기간 (일). 이전 trace + 관련 record/graph/verdict 삭제 |
| `verdictRetentionDays` | number | 90 | verdict 보존 기간 (일). trace와 독립적으로 오래된 verdict 삭제 |
| `batchSize` | number | 1000 | 배치당 처리 건수 |

처리 흐름:
```
1. 만료 verdict 배치 삭제 (verdictComputedBefore cutoff 기준)
2. 만료 trace 배치 삭제:
   - event_records (trace별)
   - runtime_graphs (trace별)
   - verdict_reports (trace별)
   - traces 자체
3. orphan session 삭제 (trace가 없는 session)
4. 결과 반환
```

응답 200:
```json
{
  "ok": true,
  "options": {
    "traceRetentionDays": 30,
    "verdictRetentionDays": 90,
    "batchSize": 1000
  },
  "cutoffs": {
    "traceCreatedBefore": "2026-02-10T00:00:00.000Z",
    "verdictComputedBefore": "2025-12-12T00:00:00.000Z"
  },
  "deleted": {
    "eventRecords": 150,
    "runtimeGraphs": 5,
    "verdictReports": 20,
    "traces": 5,
    "qaSessions": 2
  }
}
```

의존 포트:
```typescript
interface CleanupRouteDeps {
  cleanupStore: CleanupStore;
  logger?: Logger;
}

interface CleanupStore {
  listExpiredTraceIds(cutoff: Date, limit: number): Promise<string[]>;
  deleteEventRecordsByTraceIds(traceIds: string[]): Promise<number>;
  deleteRuntimeGraphsByTraceIds(traceIds: string[]): Promise<number>;
  deleteVerdictReportsByTraceIds(traceIds: string[]): Promise<number>;
  deleteTracesByIds(traceIds: string[]): Promise<number>;
  listExpiredVerdictIds(cutoff: Date, limit: number): Promise<string[]>;
  deleteVerdictReportsByIds(verdictIds: string[]): Promise<number>;
  listOrphanSessionIds(limit: number): Promise<string[]>;
  deleteQaSessionsByIds(sessionIds: string[]): Promise<number>;
}
```

---

## DLQ 삽입 시점

DLQ 항목은 ingest 후처리(Phase 2)에서 자동 생성된다:

- **reconstruction 실패**: `reconstructPendingTraces`에서 trace 재구성 실패 시 `phase: "reconstruction"`
- **verdict 실패**: `computePendingVerdicts`에서 verdict 계산 실패 시 `phase: "verdict"`

## 설정

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `DLQ_MAX_RETRY_ATTEMPTS` | 3 | 최대 재시도 횟수. 초과 시 retry에서 skip |

## 의존 포트

```typescript
interface DlqDeps {
  dlqStore: DlqStore;
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  sessionStore: SessionStore;
  scenarioSpecStore: ScenarioSpecStore;
  verdictStore: VerdictStore;
  logger?: Logger;
  maxRetryAttempts?: number;
}
```
