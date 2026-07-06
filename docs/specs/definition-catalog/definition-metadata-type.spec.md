---
def:
  id: definition-metadata-type
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
    - target: doc-type-convention
      type: depends_on
---

# Definition Metadata — `type`

## 목적 ^purpose

`def.type`은 문서가 무엇을 기록하는지 구분한다. 시스템 사실은 `design`/`spec`, 사람이 남긴 판단은 `knowledge`가 소유한다.

## 정의 ^defines

| value | 의미 | 요구 |
|-------|------|------|
| `design` | 소유권/의도/구조를 가진 설계 자산 | `owner_system` 필수 |
| `spec` | 코드/시스템에서 파생 가능한 현재 사실 | 기본값 |
| `knowledge` | 판단, 이유, 제안, 가이드 | `knowledge_kind` 필수 |

## 제약 ^constraint

- `design`/`spec`은 `knowledge_kind`를 가질 수 없다.
- `knowledge`는 behavior/source truth가 아니다. 실행 책임을 정의하면 `design`/`spec`으로 승격한다.
