---
def:
  id: def-svc-docs-module
  tier: component
  address: def_document:v2:68867
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, structural, entry-point]
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-data-model
      type: depends_on
    - target: def-svc-search-module
      type: depends_on
    - target: def-svc-semantic-grounding-module
      type: depends_on
  sources:
    - packages/definition-service/src/modules/docs/docs.service.ts
    - packages/definition-service/src/stores/doc-store.ts
---
# Definition Service — Docs Module

## 목적 ^purpose

문서 CRUD, 메타데이터 업데이트, 계층 탐색, 링크/태그 원자적 변경을 담당하는 핵심 모듈. SqlDocStore를 래핑하여 HTTP/GraphQL 양쪽에서 소비 가능한 서비스 계층을 제공한다.

## 구성 ^overview

- `DocsController`: REST 엔드포인트 (GET/PATCH/POST/DELETE)
- `DocsService`: 비즈니스 로직 (list, get, updateMetadata, addLink, removeLink, addTag, removeTag)
- `SqlDocStore`: SQLite 직접 조회 (documents + document_links)
- `SearchService`: `q` 필터의 FTS/LIKE 검색과 candidate overlap 판정
- `SemanticGroundingService`: `q` 필터의 semantic plan, feedback event 기록

### 주요 기능

| 기능 | 메서드 | 특징 |
|------|--------|------|
| 확장 필터 | list(scope, aspect, depth, layer, svc, tag, q, limit, offset, sort) | `q`가 있으면 semantic 후보 + FTS/LIKE 결과 병합 |
| 페이지네이션 조회 | listPaginated(filter) → `{docs, total, offset, limit}` | COUNT(*) 별도 실행, 정확한 total |
| 메타데이터 변경 | updateMetadata(docId, patch) | address 자동 재계산, version +1 |
| 계층 탐색 | getChildren, getParent | document_links JOIN |
| 역링크 | getIncomingLinks, getOutgoingLinks | edge 테이블 조회 |
| 원자적 link/tag | addLink, removeLink, addTag, removeTag | read-then-write 없이 단일 연산 |

### SqlDocStore 확장

- `count(filter)`: 필터 조건에 매칭되는 전체 건수
- `getMany(docIds)`: semantic candidate docId를 직접 조회하고 요청 순서를 보존
- `buildWhereClause(filter)`: WHERE 절 생성 (list + count 공유)
- `resolveOrderBy(sort)`: 정렬 옵션 — `doc_id`(기본), `synced_at`, `synced_at_desc`

### 검색 grounding 경계

`DocsService.searchWithSemanticGrounding()`은 semantic 후보가 있을 때만 pre-pagination merge 버퍼를 만든다. SemanticGroundingService가 없거나 plan에 candidate docId가 없으면 legacy FTS/LIKE 검색을 요청된 `limit/offset` 그대로 호출한다. 이 경계는 큰 offset에서 불필요한 legacy result materialization을 피하기 위한 안정화 규칙이다.
