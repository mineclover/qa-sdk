---
def:
  id: definition-metadata-tier
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
  sources:
    - packages/definition-catalog/src/types.ts
    - packages/definition-catalog/src/frontmatter.ts
    - packages/definition-catalog/src/frontmatter.test.ts
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
    - target: architecture-revealing-code-convention
      type: depends_on
---

# Definition Metadata — `tier`

## 목적 ^purpose

`def.tier`는 E/C/I/S + L/P 책임을 frontmatter에서 드러내는 구조 옵션이다. 문서가 어떤 책임 단위인지 판단하는 1차 렌즈다.

## 정의 ^defines

| value | 책임 | 직관 |
|-------|------|------|
| `entry` | Entry / Identity | 안정 ID, canonical singleton, finite value |
| `component` | Component | schema, state enum, evidence shape, validation vocabulary |
| `system` | System | 독립 behavior owner, transform, validator, projector, writer |
| `layout` | Layout / Pack | 여러 system/interface를 `refs`로 조망하는 조직 단위 |
| `exempt` | validator 면제 | 운영상 예외. 새 authoring 기본값 아님 |

## 제약 ^constraint

- Interface는 별도 tier가 아니다. `scope: interface`와 contract aspect로 표현한다.
- Pack은 별도 tier가 아니다. 배포/문서 묶음은 보통 `tier: layout` 또는 pack-specific system spec으로 표현한다.
- `tier: layout`은 `refs`를 사용하고 behavior/data ownership을 직접 갖지 않는다.
