---
def:
  id: definition-metadata-links
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
    - target: link-type-usage
      type: depends_on
---

# Definition Metadata — `links`

## 목적 ^purpose

`def.links`는 문서 사이의 그래프 관계를 선언한다. 문서의 소유권, 의존, 제약, 검증, 조망은 모두 link type으로 드러난다.

## 정의 ^defines

| type | 의미 |
|------|------|
| `depends_on` | 기능적으로 필요 |
| `implements` | 계약 구현 |
| `refines` | 더 구체화 |
| `constrains` | 규칙 부과 |
| `traces_to` | 이력/검증/관련 추적 |
| `contains` | system/group이 component/member를 소유 |
| `evolves_from` | 이전 버전에서 진화 |
| `supersedes` | 이전 정의 대체 |
| `refs` | layout/pack 조망 |
| `verifies` | test 문서가 대상 검증 |

## 제약 ^constraint

- `depends_on`, `implements`, `refines`는 cycle 검출 대상이다.
- `tier: layout`은 `contains` 대신 `refs`를 사용한다.
- link 의미와 방향은 `link-type-usage`가 상세 rule을 소유한다.
