---
def:
  id: ingest-admin-endpoints
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [tier-infra]
  links:
    - target: admin-api-spec
      type: refines
    - target: dlq-store-spec
      type: depends_on
---

# Ingest Admin 엔드포인트

## 목적 ^purpose

운영자가 사용하는 ingest admin 엔드포인트의 조회, 재시도, 강제 작업 계약을 분리해 관리 경계를 분명히 한다.

## 구성 ^overview

- **GET /v1/admin/dlq** — DLQ 적재분 조회 (status=pending 필터, limit 옵션).
- **POST /v1/admin/dlq/retry** — pending 상태의 DLQ 항목 일괄 재시도.
- DLQ 항목은 phase(reconstruction/verdict) 기반으로 재처리 경로가 분기됨.
- admin API는 ingest rate-limit과 별도 경로 (`/v1/admin/`)로 분리.

## 엔드포인트 상세

### GET /v1/admin/dlq

DLQ 적재분을 조회한다.

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `status` | `"pending"` | `pending` | 현재 pending만 지원 |
| `limit` | `number` | `50` | 최대 반환 건수 (상한 200) |

**응답:**
```json
{
  "items": [{
    "id": "dlq-xxx",
    "traceId": "trace-xxx",
    "phase": "reconstruction",
    "errorMessage": "...",
    "attemptCount": 1,
    "lastAttemptedAt": "2026-03-26T...",
    "createdAt": "2026-03-26T...",
    "resolvedAt": null
  }]
}
```

### POST /v1/admin/dlq/retry

pending 상태의 DLQ 항목을 최대 100건 조회하여 일괄 재시도한다.

**재시도 로직:**

1. `attemptCount >= maxRetryAttempts` (기본 3) → skip (재시도 한도 초과)
2. `phase === "reconstruction"` → `reconstructTrace()` 실행 → 성공 시 `markResolved()` → 후속 `computePendingVerdicts()` 실행
3. 나머지 phase → `computeTraceVerdict(force: true)` 실행

**응답:**
```json
{
  "total": 5,
  "resolved": ["dlq-1", "dlq-3"],
  "failed": ["dlq-4"],
  "skipped": ["dlq-2", "dlq-5"]
}
```

## 운영 계약

- admin API는 ingest rate-limit 미들웨어가 적용되지 않는 별도 경로
- 재시도 한도: `DLQ_MAX_RETRY_ATTEMPTS` 환경변수로 설정 (기본 3)
- 재시도와 자동 재시도 구분: admin 재시도는 `markAttempted()` 후 처리 → 이력 추적 가능
- 응답에 resolved/failed/skipped를 명시하여 잔여 실패 건수 즉시 파악 가능

## 의존 포트

| 포트 | 타입 | 설명 |
|------|------|------|
| `dlqStore` | `DlqStore` | DLQ 적재/조회/상태 갱신 |
| `recordStore` | `RecordStore` | reconstruction 시 레코드 조회 |
| `traceStore` | `TraceStore` | trace 재구성 |
| `graphStore` | `GraphStore` | trace graph 재구성 |
| `sessionStore` | `SessionStore` | session 연관 정보 |
| `scenarioSpecStore` | `ScenarioSpecStore` | verdict 계산 시 시나리오 스펙 |
| `verdictStore` | `VerdictStore` | verdict 저장 |
