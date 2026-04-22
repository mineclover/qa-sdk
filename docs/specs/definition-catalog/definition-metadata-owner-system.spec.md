---
def:
  id: definition-metadata-owner-system
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
---

# Definition Metadata — `owner_system`

## 목적 ^purpose

`def.owner_system`은 설계 자산의 최종 책임 system을 선언한다. 링크 그래프에서 파생되는 domain root와 함께 owner drift를 검출하는 기준이다.

## 정의 ^defines

| field | 값 | 의미 |
|-------|----|------|
| `owner_system` | existing `def.id` 또는 service/system id | 변경 책임을 승인할 system |

## 제약 ^constraint

- `type: design` 문서는 `owner_system`을 가져야 한다.
- `owner_system`과 graph-derived root가 다르면 링크 누락 또는 owner 선언 오류다.
- `owner_system`은 소유권 선언이지 dependency가 아니다. 실제 소비 관계는 `links`로 별도 표현한다.
