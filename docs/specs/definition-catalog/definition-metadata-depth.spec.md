---
def:
  id: definition-metadata-depth
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
    - packages/definition-catalog/src/vocabulary.ts
    - packages/definition-catalog/src/frontmatter.ts
    - packages/definition-catalog/src/frontmatter.test.ts
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
---

# Definition Metadata — `depth`

## 목적 ^purpose

`def.depth`는 문서가 어느 상세도에서 책임을 소유하는지 정의한다.

## 정의 ^defines

| value | 의미 | 보통 필요한 본문 |
|-------|------|------------------|
| `overview` | 시스템/영역 조감도 | `^overview`, 구성/위임 |
| `specification` | 상세 명세 | `^purpose`, `^defines` |
| `implementation` | 구현 상세 | source mapping, 알고리즘/adapter |
| `validation` | 검증 명세 | cases/test/gate/evidence |

## 제약 ^constraint

- `depth`는 진행 상태가 아니다. 상태는 `lifecycle`이 소유한다.
- validation 문서가 behavior truth를 새로 정의하면 cases/spec으로 분리한다.
