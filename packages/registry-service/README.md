# @qa-sdk/registry-service

`@qa-sdk/registry-service`는 카탈로그와 버전 라이프사이클의 중앙 SSOT를 서비스로 올린 구현체다. README는 기능 설명보다 중앙 spec 인덱스 역할을 한다.

## 먼저 볼 문서

- [registry-system.md](../../docs/specs/registry-system/registry-system.md) — 시스템 전체 개요
- [registry-api.spec.md](../../docs/specs/registry-system/registry-api.spec.md) — prefix/version API 계약
- [services.spec.md](../../docs/specs/registry-system/services.spec.md) — 서비스 디스커버리 API
- [events.spec.md](../../docs/specs/registry-system/events.spec.md) — event 정의 API
- [registry-service-modules.md](../../docs/specs/registry-service/registry-service-modules.md) — Nest 모듈 분해 진입점
- [registry-catalog-module.md](../../docs/specs/registry-service/registry-catalog-module.md) — catalog/config/decode-map
- [registry-versions-module.md](../../docs/specs/registry-service/registry-versions-module.md) — version lifecycle
- [registry-services-module.md](../../docs/specs/registry-service/registry-services-module.md) — service topology / endpoint registry
- [registry-dashboard-module.md](../../docs/specs/registry-service/registry-dashboard-module.md) — dev dashboard / diagram / websocket
- [registry-seed-module.md](../../docs/specs/registry-service/registry-seed-module.md) — 부팅 seed와 definition sync

## 패키지 역할

- catalog, prefix, version, axis, service, event, workspace, dashboard, seed 모듈을 조립한다.
- decode map, service endpoint, draft workspace 같은 런타임 파생 surface를 제공한다.
- 필요 시 `spec-core`를 optional peer로 사용해 activation/post-activation hook을 붙인다.

## 코드 진입점

- `src/main.ts` — NestJS 부팅
- `src/app.module.ts`, `src/runtime.module.ts` — 런타임 모듈 조립
- `src/modules/*` — feature module 경계
- `src/lib/registry-service.ts` — 핵심 lifecycle 규칙
- `src/core/seed-*.ts` — demo/runtime seed
- `src/stores/*` — SQL/InMemory 저장소 구현

## 실행

```bash
pnpm --filter @qa-sdk/registry-service build
pnpm --filter @qa-sdk/registry-service test
pnpm --filter @qa-sdk/registry-service start
```

모듈을 수정할 때는 `registry-service-modules` 문서와 해당 하위 모듈 spec을 같이 업데이트하는 흐름을 기준으로 잡는다.
