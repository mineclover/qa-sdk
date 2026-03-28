---
def:
  id: def-svc-docs-module
  level: leaf
  address: def_document:v2:68867
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [tier-infra]
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-data-model
      type: depends_on
---
# Definition Service — Docs Module

## 목적 ^purpose

문서 CRUD, 메타데이터 업데이트, 계층 탐색, 링크/태그 원자적 변경을 담당하는 핵심 모듈. SqlDocStore를 래핑하여 HTTP/GraphQL 양쪽에서 소비 가능한 서비스 계층을 제공한다.

## 구성 ^overview

- `DocsController`: REST 엔드포인트 (GET/PATCH/POST/DELETE)
- `DocsService`: 비즈니스 로직 (list, get, updateMetadata, addLink, removeLink, addTag, removeTag)
- `SqlDocStore`: SQLite 직접 조회 (documents + document_links + documents_fts)

### 주요 기능

| 기능 | 메서드 | 특징 |
|------|--------|------|
| 확장 필터 | list(scope, aspect, depth, layer, svc, tag, q, limit, offset, sort) | FTS5 전문검색 포함 |
| 페이지네이션 조회 | listPaginated(filter) → `{docs, total, offset, limit}` | COUNT(*) 별도 실행, 정확한 total |
| 메타데이터 변경 | updateMetadata(docId, patch) | address 자동 재계산, version +1 |
| 계층 탐색 | getChildren, getParent | document_links JOIN |
| 역링크 | getIncomingLinks, getOutgoingLinks | edge 테이블 조회 |
| 원자적 link/tag | addLink, removeLink, addTag, removeTag | read-then-write 없이 단일 연산 |

### SqlDocStore 확장

- `count(filter)`: 필터 조건에 매칭되는 전체 건수
- `buildWhereClause(filter)`: WHERE 절 생성 (list + count 공유)
- `resolveOrderBy(sort)`: 정렬 옵션 — `doc_id`(기본), `synced_at`, `synced_at_desc`
