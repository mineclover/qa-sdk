# @qa-sdk/decision-service

`@qa-sdk/decision-service`는 decision-flow 라이브러리를 서비스로 올린 구현체다. 기능 설명의 SSOT는 `docs/specs/decision-service/`에 있다.

## 먼저 볼 문서

- [decision-service-system.md](../../docs/specs/decision-service/decision-service-system.md) — 서비스 전체 개요
- [dec-svc-api-contract.md](../../docs/specs/decision-service/dec-svc-api-contract.md) — REST API 계약
- [dec-svc-data-model.md](../../docs/specs/decision-service/dec-svc-data-model.md) — SQLite 테이블 구조
- [dec-svc-schemas-module.md](../../docs/specs/decision-service/dec-svc-schemas-module.md) — FlowSchema 모듈
- [dec-svc-instances-module.md](../../docs/specs/decision-service/dec-svc-instances-module.md) — FlowInstance 모듈
- [dec-svc-links-module.md](../../docs/specs/decision-service/dec-svc-links-module.md) — 문서 연결 추적
- [dec-svc-constraints.md](../../docs/specs/decision-service/dec-svc-constraints.md) — fail-open 포함 제약 조건

## 패키지 역할

- FlowSchema와 FlowInstance를 DB에 영속한다.
- `flow_links`를 통해 의사결정과 definition 문서를 연결한다.
- `decision-flow` 타입과 런타임 모델을 서비스 경계로 노출한다.

## 코드 진입점

- `src/main.ts` — NestJS 부팅
- `src/app.module.ts` — 모듈 조립
- `src/db/schema.ts` — DB 스키마
- `src/health.controller.ts` — health surface

## 실행

```bash
pnpm --filter @qa-sdk/decision-service build
pnpm --filter @qa-sdk/decision-service test
pnpm --filter @qa-sdk/decision-service start
```

`test`는 production build와 `tsc` build 후 in-memory SQLite에 실제 migrations를 적용하고 health, schema upsert/delete, instance save/update/list, flow link create/query/unlink를 검증한다. API/상태 전이 semantics는 중앙 spec을 기준으로 유지한다.
