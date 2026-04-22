---
def:
  id: definition-metadata-tags
  type: design
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [metadata, structural, coordinate-cluster]
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
    - target: tag-management-spec
      type: depends_on
---

# Definition Metadata — `tags`

## 목적 ^purpose

`def.tags`는 좌표를 대체하지 않고 횡단 관심사와 structural hint를 부여한다.

## 정의 ^defines

| category | 대표 값 | 용도 |
|----------|---------|------|
| concern | security, performance, accessibility, observability, testing, migration, deprecation | 영향/closure/evidence 요구 |
| structural | entry-point, cross-scope, decision, generated | graph/validator 의도 선언 |
| operational | runtime, persistence, contract, versioning | 탐색 보조 |

## 제약 ^constraint

- tag로 scope/aspect/tier를 대신하지 않는다.
- suppression 성격의 tag는 `validator-suppression-tags` 규칙을 따른다.
- tag가 concern을 드러내면 관련 rule/test/evidence가 필요할 수 있다.
