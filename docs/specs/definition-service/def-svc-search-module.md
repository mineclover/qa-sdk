---
def:
  id: def-svc-search-module
  tier: component
  address: def_document:v2:68869
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, structural, performance]
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-data-model
      type: depends_on
sources:
  - packages/definition-service/src/modules/search/search.service.ts
  - packages/definition-service/src/modules/search/search.service.test.ts
---
# Definition Service — Search Module

## 목적 ^purpose

drizzle이 관리하지 않는 FTS5 VIRTUAL TABLE의 lifecycle을 독립 관리하는 검색 모듈. 문서의 purpose/intent/context/caveat를 전문 검색하고, sync 후 벌크 재인덱싱을 수행한다. 나중에 외부 검색엔진(Meilisearch 등)으로 교체 시 이 모듈만 변경.

## 구성 ^overview

- `SearchService` (@Global): onModuleInit에서 FTS5 테이블 CREATE IF NOT EXISTS
- `index(docId, purpose, intent, context, caveat)`: 문서 인덱싱 (upsert 후 호출)
- `search(query, limit, offset)`: FTS5 MATCH → LIKE fallback → DocRecord[]
- `searchCount(query)`: 검색 전체 매칭 건수 (pagination용)
- `matchDocIds(query, docIds)`: semantic candidate가 기존 FTS/LIKE 결과와 겹치는지 docId subset에서 판정
- SyncService가 sync 완료 후 전체 문서를 페이지 단위로 순회하며 `index()`를 호출
- DocsService가 `?q=` 필터 시 SearchService.search/searchCount/matchDocIds를 semantic grounding plan과 함께 사용

### 토크나이저 전략

- **기본**: FTS5 `trigram` 토크나이저 — 3글자 단위 토큰으로 CJK(한국어/중국어/일본어) 부분 문자열 매칭 지원
- **fallback**: trigram 미지원 환경에서는 기본 토크나이저로 생성
- **LIKE fallback**: FTS5 MATCH 결과가 0건이거나 실패 시 `WHERE purpose LIKE ? OR intent LIKE ? ...` 쿼리로 자동 전환
- **candidate overlap**: semantic candidate docId에 대해서는 전체 legacy result를 재조회하지 않고 `doc_id IN (...)` 범위에서 FTS/LIKE 매칭 여부만 확인

### 아키텍처 컨벤션

- drizzle은 정규 테이블만 관리 (src/db/schema.ts → drizzle-kit generate)
- FTS5 등 drizzle 미지원 기능은 전용 NestJS 모듈이 onModuleInit에서 생성
- migration.sql에 FTS5를 넣지 않음 — SearchModule이 소유
