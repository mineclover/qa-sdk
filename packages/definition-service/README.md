# @qa-sdk/definition-service

`@qa-sdk/definition-service`는 문서 메타데이터를 SQLite와 API surface로 제공하는 서비스다. 이 패키지는 중앙 spec을 먼저 보고 코드를 따라가는 방식으로 읽는 것이 맞다.

## 먼저 볼 문서

- [definition-service-system.md](../../docs/specs/definition-service/definition-service-system.md) — 서비스 전체 진입점
- [def-svc-api-contract.md](../../docs/specs/definition-service/def-svc-api-contract.md) — REST + GraphQL 계약
- [def-svc-data-model.md](../../docs/specs/definition-service/def-svc-data-model.md) — documents/document_links/FTS 모델
- [def-svc-docs-module.md](../../docs/specs/definition-service/def-svc-docs-module.md) — docs CRUD 경계
- [def-svc-graph-module.md](../../docs/specs/definition-service/def-svc-graph-module.md) — graph 탐색 경계
- [def-svc-sync-module.md](../../docs/specs/definition-service/def-svc-sync-module.md) — file↔DB sync
- [def-svc-search-module.md](../../docs/specs/definition-service/def-svc-search-module.md) — 검색/FTS surface
- [def-svc-constraints.md](../../docs/specs/definition-service/def-svc-constraints.md) — axis registry/fail-open 제약

## 패키지 역할

- 문서 메타데이터는 DB SSOT, 본문은 파일 SSOT라는 경계를 유지한다.
- docs, graph, sync, graphql, prefixes, intents, consumption, tests 모듈을 조립한다.
- definition-catalog의 graph 규칙과 work-domain 보조 모델을 API에서 재사용한다.

## 코드 진입점

- `src/main.ts` — NestJS 부팅
- `src/app.module.ts` — 모듈 조립
- `src/core/sync-engine.ts` — sync 핵심 로직
- `src/sync/scanner.ts`, `src/sync/reverse-sync.ts` — 양방향 sync 구현
- `src/modules/*` — API 모듈 경계
- `src/db/schema.ts` — DB 스키마

## 실행

```bash
pnpm --filter @qa-sdk/definition-service build
pnpm --filter @qa-sdk/definition-service test
pnpm --filter @qa-sdk/definition-service start
```

운영 환경 변수와 초기화 순서는 [definition-runtime-guide.md](../../docs/specs/guides-system/definition-runtime-guide.md)를 같이 본다.
