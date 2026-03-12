# @qa-sdk/ingest-server — Specs

SDK의 Transmission Envelope을 수신하고 store에 저장하는 HTTP 서버.

## 진입점별 스펙

| 스펙 | 설명 | 상태 |
|---|---|---|
| [ingest.spec.md](ingest.spec.md) | POST /v1/ingest — envelope 수신, 저장, reconstruction, verdict 자동 계산 | implemented |
| [query.spec.md](query.spec.md) | GET /v1/traces, /v1/sessions — trace/session/record 조회 (cursor pagination) | implemented |
| [scenario.spec.md](scenario.spec.md) | POST/GET/DELETE /v1/scenarios — ScenarioSpec CRUD | implemented |
| [verdict.spec.md](verdict.spec.md) | GET verdicts, POST recompute — verdict 조회 및 강제 재계산 | implemented |
| [stream.spec.md](stream.spec.md) | SSE 기반 실시간 trace/session 스트리밍 (heartbeat, 연결 제한 포함) | implemented |
| [admin.spec.md](admin.spec.md) | DLQ 조회/재시도, 만료 데이터 정리 — 운영 관리 API | implemented |
| [infrastructure.spec.md](infrastructure.spec.md) | health check, rate limiting, API key 인증, request ID, graceful shutdown | implemented |
