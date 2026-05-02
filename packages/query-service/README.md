# query-service

`query-service`는 좌표 질의, 정책 규칙, gate 통합을 제공하는 서비스다. 구현 목표와 API surface는 `docs/specs/query-system/`이 SSOT다.

## 먼저 볼 문서

- [query-system.md](../../docs/specs/query-system/query-system.md) — 서비스 전체 개요
- [query-api.spec.md](../../docs/specs/query-system/query-api.spec.md) — 질의 REST API
- [query-rules.spec.md](../../docs/specs/query-system/query-rules.spec.md) — PolicyRule CRUD와 충돌 전략
- [query-gate-integration.spec.md](../../docs/specs/query-system/query-gate-integration.spec.md) — gate-service 연동
- [query-state-replay.spec.md](../../docs/specs/query-system/query-state-replay.spec.md) — replay/cache 경로
- [query-rule-migration.spec.md](../../docs/specs/query-system/query-rule-migration.spec.md) — 규칙 마이그레이션

## 패키지 역할

- 관계형 질의와 정책 규칙 저장소를 묶는다.
- `gate-service`가 있을 때 gate 상태를 질의 결과에 합성한다.
- Node/Workers 환경 모두에서 SQLite/D1 기반 rule store를 유지한다.

## 코드 진입점

- `src/server.ts` — Node 서버 부팅
- `src/app.ts` — Hono 앱 조립
- `src/routes/query.ts`, `src/routes/rules.ts`, `src/routes/state.ts` — 핵심 HTTP 표면
- `src/lib/query-service.ts` — 질의 엔진 façade
- `src/stores/policy-rule-store.ts`, `src/stores/sql-policy-rule-store.ts` — 규칙 저장소
- `src/lib/gate-client.ts` — gate-service 연동

## 실행

```bash
pnpm --filter query-service build
pnpm --filter query-service test
pnpm --filter query-service start
```

현재 패키지의 구현 위치를 읽을 때는 `routes`보다 spec 문서의 API/제약을 먼저 보고 들어가는 편이 정확하다.
