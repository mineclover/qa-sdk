# @qa-sdk/platform-demo-api

`@qa-sdk/platform-demo-api`는 demo-snapshot 카탈로그를 Cloudflare Workers + Hono API로 노출하는 데모용 backend surface다.

## 먼저 볼 문서

- [platform-demo-api.spec.md](../../docs/specs/viz-system/platform-demo-api.spec.md) — API contract 모듈
- [platform-demo-api.md](../../docs/specs/viz-system/platform-demo-api-spec/platform-demo-api.md) — 패키지 개요
- [index-meta/README.md](../../docs/specs/indexing/index-meta/README.md) — registry/capacity 문맥
- [permission-engine/README.md](../../docs/specs/indexing/permission-engine/README.md) — permission 문맥

## 패키지 역할

- demo-snapshot SSOT를 기반으로 인코딩/디코딩과 버전 조회 API를 제공한다.
- `service`, `permission`, `event` 좌표를 HTTP로 소비하게 하는 데모 backend다.
- Cloudflare Workers 환경에서 `index-meta`와 `permission-engine`을 묶는 adapter 역할을 한다.

## 코드 진입점

- `src/index.ts` — Hono 앱과 라우트 조립
- `src/registry.ts` — demo-snapshot 기반 registry/codec
- `wrangler.toml` — Workers 설정
- `drizzle.config.ts` — D1 schema 설정

## 실행

```bash
pnpm --filter @qa-sdk/platform-demo-api dev
pnpm --filter @qa-sdk/platform-demo-api test
pnpm --filter @qa-sdk/platform-demo-api typecheck
pnpm --filter @qa-sdk/platform-demo-api db:generate
pnpm --filter @qa-sdk/platform-demo-api deploy  # production 환경
```

`test`는 Worker를 띄우지 않고 Hono `app.request()`로 health, dashboard read-model, prefix metadata, service/permission/event read-only routes를 검증한다. D1 grant/log mutation routes는 별도 runtime 검증 대상으로 둔다.
