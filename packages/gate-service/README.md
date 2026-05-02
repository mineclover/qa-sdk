# gate-service

`gate-service`는 주소 공간의 active/inactive/open/reserved 상태를 읽기 전용으로 노출하는 서비스다.

## 먼저 볼 문서

- [gate-system.md](../../docs/specs/gate/gate-system.md) — 전체 진입점
- [gate-api.spec.md](../../docs/specs/gate/gate-api.spec.md) — HTTP/RPC 계약
- [gate-engine-group.md](../../docs/specs/gate/gate-engine-group.md) — 엔진 관련 세부 그룹
- [gate-constraint.spec.md](../../docs/specs/gate/gate-constraint.spec.md) — 기술 제약
- [gate-scenario.spec.md](../../docs/specs/gate/gate-scenario.spec.md) — 핵심 시나리오

## 패키지 역할

- 주소 상태를 조회하고 recompute/cascade/filter API를 제공한다.
- 읽기 전용 캐시 서비스이며, 실제 GateEngine 계산은 `index-meta`가 담당한다.
- query-service와 encode 경로가 이 패키지를 상태 판정 surface로 소비한다.

## 코드 진입점

- `src/server.ts` — Node 서버 부팅
- `src/app.ts` — Hono 앱 조립
- `src/routes/gate.ts`, `src/routes/gate-openapi.ts`, `src/routes/health.ts`, `src/routes/metrics.ts` — API 표면
- `src/lib/gate-service.ts` — 게이트 조회 코어
- `src/services/cache-invalidation.ts`, `src/services/consistency.ts` — 보조 서비스
- `src/config/env.ts` — 환경 설정

## 실행

```bash
pnpm --filter gate-service build
pnpm --filter gate-service test
pnpm --filter gate-service start
```
