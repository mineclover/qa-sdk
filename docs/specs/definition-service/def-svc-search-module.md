---
def:
  id: def-svc-search-module
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
# Definition Service — Search Module

## 목적 ^purpose

drizzle이 관리하지 않는 FTS5 VIRTUAL TABLE의 lifecycle을 독립 관리하는 검색 모듈. 문서의 purpose/intent/context/caveat를 전문 검색하고, sync 후 벌크 재인덱싱을 수행한다. 나중에 외부 검색엔진(Meilisearch 등)으로 교체 시 이 모듈만 변경.

## 구성 ^overview

- `SearchService` (@Global): onModuleInit에서 FTS5 테이블 CREATE IF NOT EXISTS
- `index(docId, purpose, intent, context, caveat)`: 문서 인덱싱 (upsert 후 호출)
- `search(query, limit)`: FTS5 MATCH 쿼리 → DocRecord[] 반환
- SyncService가 sync 완료 후 rebuildSearchIndex() 호출 (525건 벌크)
- DocsService가 `?q=` 필터 시 SearchService.search()로 위임

### 아키텍처 컨벤션

- drizzle은 정규 테이블만 관리 (src/db/schema.ts → drizzle-kit generate)
- FTS5 등 drizzle 미지원 기능은 전용 NestJS 모듈이 onModuleInit에서 생성
- migration.sql에 FTS5를 넣지 않음 — SearchModule이 소유
