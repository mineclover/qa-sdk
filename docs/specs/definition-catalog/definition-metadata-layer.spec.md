---
def:
  id: definition-metadata-layer
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

# Definition Metadata — `layer`

## 목적 ^purpose

`def.layer`는 문서가 왜 존재하는지 정의한다. scope/aspect가 "무엇"이라면 layer는 "왜"를 표현한다.

## 정의 ^defines

| value | 삭제하면 | 전파 방향 |
|-------|----------|-----------|
| `domain` | 비즈니스/시스템 진실이 바뀜 | domain → operation/mediation |
| `operation` | 시스템 운영이 느려지거나 깨짐 | operation 내부 |
| `mediation` | 소비/번역이 불편해짐 | mediation → experience |
| `experience` | 사용자 유도/표현이 약해짐 | experience 내부 |

## 제약 ^constraint

- layer는 scope/aspect를 대체하지 않는다.
- 영향 분석은 layer를 cascade 방향 판단에 사용한다.
