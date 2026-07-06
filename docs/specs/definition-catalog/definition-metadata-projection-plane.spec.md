---
def:
  id: definition-metadata-projection-plane
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
sources:
  - packages/definition-catalog/src/types.ts
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/frontmatter.test.ts
---

# Definition Metadata — `projection_plane`

## 목적 ^purpose

`def.projection_plane`은 문서가 설계 의도인지 실행 사실인지 구분한다. 같은 code/doc 연결이라도 의도와 실증을 섞지 않기 위한 metadata다.

## 정의 ^defines

| value | 의미 | 예 |
|-------|------|----|
| `intent` | 설계자의 규범적 의도 | specs, rules, plans |
| `execution` | 코드/런타임에서 관찰된 사실 | generated runtime evidence, source-owned projection |

## 제약 ^constraint

- 일반 definition markdown은 기본적으로 `intent`다.
- `execution`은 코드나 관측에서 파생되는 사실을 투영할 때만 사용한다.
- intent 문서가 execution 사실을 장기 보관하면 drift가 생긴다. 구현 완료 후 spec/source evidence로 흡수한다.
