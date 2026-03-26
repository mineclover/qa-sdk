---
def:
  id: ingest-runtime-middleware
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  tags: [performance, observability, tier-infra]
  links:
    - target: ingest-infra-spec
      type: refines
    - target: ingest-api-spec
      type: constrains
---

# Ingest 런타임 미들웨어

## 목적 ^purpose

health check, rate limiting, request ID, error handler 미들웨어 규칙을 분리해 ingest 서비스의 공통 제약을 정리한다.

## 구성 ^overview

- **Request ID** — 모든 요청에 고유 ID 부여 (진단 추적용).
- **CORS** — `CORS_ORIGIN` 기반 cross-origin 허용 (기본 `*`).
- **Shutdown Middleware** — shutdown 중 새 요청을 503으로 거부.
- **Rate Limiter** — `/v1/ingest` POST 요청에 대해 IP 기반 슬라이딩 윈도우 제한.
- **Error Handler** — 중앙 에러 핸들러로 일관된 에러 응답 형식 보장.

## 미들웨어 적용 순서

```
1. cors (모든 경로)
2. requestId (모든 경로)
3. shutdownMiddleware (모든 경로)
4. ingestRateLimiter (/v1/ingest만)
... 라우트 핸들러 ...
N. errorHandler (onError — 가장 마지막)
```

- request ID가 가장 먼저 → 모든 로그/응답에서 추적 가능
- error handler가 가장 마지막 → 미들웨어/핸들러의 모든 에러를 포착

## Rate Limiter 상세

IP 기반 슬라이딩 윈도우 방식의 요청 제한:

| 설정 | 환경변수 | 기본값 | 설명 |
|------|---------|--------|------|
| 윈도우 크기 | `RATE_LIMIT_WINDOW_MS` | 60,000 | 슬라이딩 윈도우 밀리초 |
| 최대 요청 | `RATE_LIMIT_MAX_REQUESTS` | 100 | 윈도우당 최대 POST 요청 수 |

**동작:**

1. POST 요청만 대상 (GET은 제한 없음)
2. 클라이언트 키: `X-Forwarded-For` → `socket.remoteAddress` → `"unknown"`
3. 윈도우 내 타임스탬프 배열로 카운트 (만료된 항목 자동 정리)
4. 한도 초과 시 429 응답:
   ```json
   {
     "error": {
       "code": "RATE_LIMITED",
       "message": "rate limit exceeded for POST /v1/ingest (max 100 requests per 60000ms window)",
       "retryAfterMs": 12345
     }
   }
   ```

**응답 헤더:**

| 헤더 | 설명 |
|------|------|
| `X-RateLimit-Limit` | 윈도우당 최대 요청 수 |
| `X-RateLimit-Remaining` | 잔여 요청 수 |
| `X-RateLimit-Reset` | 윈도우 리셋 시각 (epoch ms) |

- admin 경로 (`/v1/admin/`)는 rate-limit 대상이 아님
- SSE/WebSocket 경로도 rate-limit 미적용

## Health Check

| 경로 | 용도 | 의존 |
|------|------|------|
| `/health` | 전체 상태 (DB 연결 + uptime + version) | DB 건전성 체크 |
| `/health/live` | liveness probe (k8s) | 없음 (`{ ok: true }`) |
| `/health/ready` | readiness probe | DB 건전성 체크 |

- health check는 저장소/큐 의존성과 분리된 경량 경로
- DB 연결 실패 시 `/health`와 `/health/ready`는 503 반환
- `/health/live`는 항상 200 (프로세스 생존 확인만)

## Shutdown Middleware

`appLifecycle.beginShutdown()` 호출 후:

- 새 요청은 503 `{ error: "server shutting down" }` 응답
- 진행 중인 요청은 완료까지 허용
- SSE 연결은 `streamConnectionRegistry.shutdown("server_shutdown")`으로 정리
