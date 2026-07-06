---
def:
  id: definition-service
  intent_hierarchy: core
  type: design
  tier: layout
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  owner_system: definition-service
  projection_plane: intent
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: definition-service-sync
      type: depends_on
    - target: definition-service-sync
      type: refs
  sources:
    - packages/definition-service/src/modules/docs/docs.service.ts
    - packages/definition-service/src/modules/docs/docs.service.test.ts
    - packages/definition-service/src/modules/graph/graph.service.ts
    - packages/definition-service/src/modules/sync/sync.service.ts
    - packages/definition-service/src/db/schema.ts
    - packages/definition-service/src/stores/doc-store.ts
    - packages/definition-data-source/src/factory.ts
    - packages/definition-data-source/src/local-data-source.ts
    - packages/definition-data-source/src/server-data-source.ts
    - packages/cli/src/commands/def.ts
---

# Definition Service — 문서 카탈로그 API 서비스

## 목적 ^purpose

`definition-catalog`가 정의한 메타데이터 모델을 SQLite 및 API로 제공하여 CLI, 웹 UI, 타 서비스들이 문서 정보를 조회하고 검증할 수 있게 하는 백엔드 서비스.

## 구성 ^overview

- **Docs Module**: 문서 단건 조회, address 조회, 본문 조회, 검색/semantic merge, 파일→문서 boundary 해석
- **Graph Module**: 링크 검증, concern 전파, impact, boundary-context 조회
- **Sync Module**: file→DB sync, DB→file reverse sync, aspect parent self-heal, 검색/semantic materialization
- **Data Source Layer**: CLI에서 local SQLite, HTTP server, scan fallback을 동일 `DefDataSource` 인터페이스로 소비
- **Core Database**: `definition-service.sqlite`의 documents, document_links, history, code_references, semantic grounding 테이블

## 조회 표면 ^api-surface

- CLI: `qa-sdk def sync|validate|get|incoming|outgoing|boundary|boundary-context`
- Local DB: `definition-data-source`의 `LocalDataSource`
- HTTP service: `definition-service`의 Docs/Graph/Sync controllers와 `ServerDataSource`
- Fallback: DB와 service가 없으면 scan mode가 read-only 조회를 제공

## 관련 소스

- `packages/definition-service/src/modules/docs/docs.service.ts` — 문서 조회/search/boundary API
- `packages/definition-service/src/modules/graph/graph.service.ts` — graph validate/impact/concern/boundary-context
- `packages/definition-service/src/modules/sync/sync.service.ts` — sync orchestration
- `packages/definition-service/src/db/schema.ts` — SQLite/Drizzle schema
- `packages/definition-data-source/src/factory.ts` — CLI data source 자동 선택
- `packages/cli/src/commands/def.ts` — 사용자 CLI 표면
