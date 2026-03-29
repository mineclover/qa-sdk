---
def:
  id: tag-search
  level: leaf
  address: def_document:v2:342035
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  tags: [domain, tagging, search]
  links:
    - target: tag-search-spec
      type: refines
    - target: tag-management-spec
      type: depends_on
---
# tag-search

## 목적 ^purpose

좌표계 외부의 태그 기반 검색 인덱스 라이브러리. 대상에 다중 태그를 부착하고, 태그 조합으로 역색인 검색을 수행한다.

## 구성 ^overview

- **TagStore** (port): 태그 저장·검색 추상 인터페이스 — attach / detach / query / summary
- **InMemoryTagStore**: 메모리 기반 구현체
- **TagAttachment**: 대상(targetKind + targetId)에 태그를 부착하는 단위
- **TagQuery**: 포함/제외 조건 + targetKind 필터로 검색
- **normalizeTag()**: 태그 정규화 (소문자, trim, 중복 방지)

## 설계 결정 ^intent

- 좌표계(prefix/dim)와 직교하는 분류 체계 — 좌표가 아닌 속성 기반 필터링
- Port/Adapter 패턴으로 영속 계층 교체 가능
- tag-management.spec.md의 카디널리티·전파 규칙을 따름
