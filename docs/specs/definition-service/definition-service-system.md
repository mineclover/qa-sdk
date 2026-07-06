---
def:
  id: definition-service-system
  tier: system
  address: def_document:v2:68622
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [structural, entry-point]
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: def-svc-data-model
      type: contains
    - target: def-svc-docs-module
      type: contains
    - target: def-svc-graph-module
      type: contains
    - target: def-svc-sync-module
      type: contains
    - target: def-svc-api-contract
      type: contains
    - target: def-svc-state-model
      type: contains
    - target: def-svc-constraints
      type: contains
    - target: def-svc-search-module
      type: contains
    - target: def-svc-semantic-grounding-module
      type: contains
    - target: definition-client-spec
      type: contains
    - target: docs-explorer
      type: contains
  sources:
    - packages/definition-service/src/app.module.ts
    - packages/definition-service/src/main.ts
    - packages/definition-service/src/db/schema.ts
    - packages/definition-service/src/modules/docs/docs.module.ts
    - packages/definition-service/src/modules/graph/graph.module.ts
    - packages/definition-service/src/modules/sync/sync.module.ts
    - packages/definition-service/src/modules/search/search.module.ts
    - packages/definition-service/src/modules/semantic-grounding/semantic-grounding.module.ts
    - packages/definition-client/src/index.ts
---
# Definition Service — 시스템 개요

## 목적 ^purpose

마크다운 문서의 메타데이터를 DB로 관리하고, 좌표 기반 분류/검색/그래프 분석을 API로 제공하는 NestJS 서비스. DB가 메타데이터 SSOT이며, frontmatter는 읽기 전용 캐시. 문서 본문(purpose/intent/context)은 파일이 SSOT.

## 구성 ^overview

- NestJS + Fastify + Mercurius(GraphQL) + SQLite
- 포트 3700, 핵심 모듈: docs, graph, sync, search, semantic-grounding, graphql, prefixes, intents, consumption, tests
- DB: documents + document_links(edge) + documents_fts(FTS5) + document_history + semantic_grounding 계열 테이블
- 양방향 동기화: file→DB (`POST /sync`), DB→file (`POST /sync/to-files`)
- GraphQL 읽기 + REST 쓰기 하이브리드 API
- 검색 grounding: 문서 sync 후 semantic terms/aliases를 SQLite에 materialize하고, `GET /docs?q=`에서 semantic 후보와 FTS 결과를 병합한다.
