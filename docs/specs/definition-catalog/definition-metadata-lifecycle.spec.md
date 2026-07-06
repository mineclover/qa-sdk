---
def:
  id: definition-metadata-lifecycle
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
    - target: work-lifecycle
      type: depends_on
sources:
  - packages/definition-catalog/src/types.ts
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/harness-state-model.ts
  - packages/definition-catalog/src/frontmatter.test.ts
---

# Definition Metadata — `lifecycle`

## 목적 ^purpose

`def.lifecycle`은 문서 자체의 상태를 정의한다. 좌표 주소에는 포함하지 않고, harness와 validator가 현재 사용 가능성을 판단하는 메타데이터로 소비한다.

## 정의 ^defines

| value | 의미 |
|-------|------|
| `draft` | 초안, 실행/검증 전 |
| `review` | 검토 중 |
| `approved` | 현재 사용 가능한 정의 |
| `deprecated` | 폐기 예정, 참조 축소 대상 |
| `archived` | 보관, active graph에서 제외 대상 |

## 제약 ^constraint

- `.todo.md`는 보통 `draft`, `.spec.md`/`.rule.md`/`.cases.md`/`.test.md`는 승인된 현행 정의면 `approved`다.
- lifecycle 변경은 주소 변경이 아니다.
- completed todo는 spec assimilation 또는 archive review가 필요하다.
