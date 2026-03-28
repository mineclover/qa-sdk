---
def:
  id: tag-search-spec
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: indexing-core-system
      type: refines
---
# Tag Search

## 목적 ^purpose

좌표계와 독립적으로 동작하는 태그 기반 역색인. record/trace/session/prefix/service 5종 대상에 다중 태그를 부착하고, AND/OR 연산자로 검색한다. 태그 정규화(`normalizeTag`)로 소문자+트림+하이픈 변환을 보장한다.

## 구성 ^overview

- `TagStore` 포트: `attach()`, `detach()`, `detachAll()`, `getTags()`, `search()`, `listTags()`, `count()`
- `TagTarget`: `record | trace | session | prefix | service`
- `TagQuery`: tags[] + operator(AND/OR) + targetKind 필터 + 시간/페이지네이션
- `InMemoryTagStore`: 개발/테스트용 인메모리 구현
- 소스: `packages/tag-search/src/`
