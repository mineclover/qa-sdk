---
def:
  id: ingest-infra-spec
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [performance, observability]
  links:
    - target: ingest-api-spec
      type: constrains
    - target: query-api-spec
      type: constrains
    - target: scenario-api-spec
      type: constrains
    - target: stream-api-spec
      type: constrains
    - target: verdict-api-spec
      type: constrains
    - target: admin-api-spec
      type: constrains
    - target: ingest-pipeline-flow
      type: constrains
---
# Infrastructure

## 목적 ^purpose

health check, rate limiting, request ID, graceful shutdown 등 ingest 서비스 인프라 제약.

## 상태

implemented

## Health Check

### GET /health

상세 readiness 체크. DB 연결 상태와 지연시간을 포함.

응답 200 (정상):
```json
{
  "ok": true,
  "version": "1.2.3",
  "uptime_seconds": 42,
  "db": { "connected": true, "latency_ms": 7 }
}
```

응답 503 (비정상): 동일 구조, `ok: false`.

### GET /health/live

프로세스 생존 확인. DB 접속하지 않음.

응답 200: `{ "ok": true }`

### GET /health/ready

readiness 체크. `/health`와 동일.

### 의존 포트

```typescript
type DbHealthChecker = () => Promise<{ connected: boolean; latency_ms: number }>;
```

- `checkDbHealth`가 제공되지 않으면 DB 체크 없이 `ok: true` 반환

## Rate Limiting

`POST /v1/ingest` 에만 적용되는 IP 기반 슬라이딩 윈도우.

### 동작

- 클라이언트 IP별로 윈도우 내 요청 수를 추적
- IP 해석 우선순위: `x-forwarded-for` 첫 번째 IP → socket `remoteAddress` → `"unknown"`
- 윈도우 초과 시 429 반환

### 응답 헤더

| 헤더 | 설명 |
|---|---|
| `X-RateLimit-Limit` | 윈도우 내 최대 요청 수 |
| `X-RateLimit-Remaining` | 남은 요청 수 |
| `X-RateLimit-Reset` | 윈도우 리셋 Unix timestamp |

### 429 응답

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "rate limit exceeded for POST /v1/ingest (max 100 requests per 60000ms window)",
    "retryAfterMs": 12345
  }
}
```

### 설정

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | 60000 | 슬라이딩 윈도우 크기 (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | 윈도우 내 최대 요청 수 |

## Request ID

모든 요청에 고유 ID를 부여.

- 요청의 `x-request-id` 헤더가 있으면 그대로 사용
- 없으면 `crypto.randomUUID()`로 생성
- 응답 `x-request-id` 헤더에 항상 설정

## Graceful Shutdown

SIGTERM 수신 시 진행 중인 요청을 완료한 후 종료.

### 동작

```
1. SIGTERM 수신
2. appLifecycle.beginShutdown()
3. 새 ingest 요청 → 503 SERVER_SHUTTING_DOWN
4. 기존 ingest 요청 → 완료까지 대기 (waitForInFlightIngestRequests)
5. SSE 연결 drain
6. 30초 timeout 후 강제 종료
```

### 503 응답

```json
{
  "error": {
    "code": "SERVER_SHUTTING_DOWN",
    "message": "server is shutting down"
  }
}
```

### AppLifecycle 인터페이스

```typescript
interface AppLifecycle {
  beginShutdown(): boolean;
  isShuttingDown(): boolean;
  tryStartIngestRequest(): (() => void) | null;
  getInFlightIngestRequestCount(): number;
  waitForInFlightIngestRequests(): Promise<void>;
}
```

- `tryStartIngestRequest`: shutdown 중이면 `null` 반환, 아니면 cleanup 함수 반환
- in-flight 카운트가 0이 되면 대기 중인 drain waiter들을 resolve

## Error Handler

모든 예외를 표준 응답으로 변환.

| 에러 타입 | 상태 | 코드 |
|---|---|---|
| `AppError` | 커스텀 (400/404 등) | AppError.code |
| `ZodError` | 400 | `INVALID_INPUT` |
| 기타 | 500 | `INTERNAL_ERROR` |

- 알 수 없는 에러는 request ID와 함께 로깅하되 클라이언트에는 generic 메시지 반환

## 미들웨어 적용 순서

```
requestId → shutdown → rateLimiter (/v1/ingest만) → errorHandler
```
