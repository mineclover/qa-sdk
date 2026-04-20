---
def:
  id: tag-search
  level: leaf
  tier: component
  address: def_document:v2:342035
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: deprecated
  svc: tag-search
  tags: [domain, tagging, search]
  links:
    - target: tag-management-spec
      type: traces_to
---
# tag-search (deprecated)

## 목적 ^purpose

~~좌표계 외부의 태그 기반 검색 인덱스 라이브러리.~~

**deprecated** — `tag-management.spec.md`에 흡수됨.
태그 저장/조회/전파/충돌 규칙은 `storage-system/tag-management.spec.md`가 SSOT.
역검색 API는 `definition-service` 검색 모듈(SearchModule, FTS5)이 담당.

## 대체 경로

| tag-search 개념 | 대체 | 위치 |
|----------------|------|------|
| TagStore (attach/detach) | 대상 저장소에 직접 저장 | tag-management.spec.md §targets |
| TagQuery (include/exclude) | definition-service SearchModule | `definition-service/src/modules/search/` |
| normalizeTag | definition-catalog taxonomy | `definition-catalog/src/taxonomy.ts` KNOWN_TAGS |
| InMemoryTagStore | 별도 store 불필요 | tag-management.spec.md 설계 결정 |

## 관련

- `docs/specs/storage-system/tag-management.spec.md` — 태그 관리 SSOT
- `docs/specs/definition-catalog/definition-taxonomy.spec.md` — KNOWN_TAGS 분류
- `packages/definition-service/src/modules/search/` — 실제 태그 검색 구현
