---
def:
  id: definition-metadata-knowledge-kind
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
---

# Definition Metadata — `knowledge_kind`

## 목적 ^purpose

`def.knowledge_kind`는 `type: knowledge` 문서의 세부 기록 목적을 정의한다.

## 정의 ^defines

| value | 기록 |
|-------|------|
| `philosophy` | 시스템 철학/본질 |
| `adr` | 아키텍처 결정 |
| `guide` | 사용법/판단 기준 |
| `narrative` | 진화 과정/맥락 |
| `convention` | 합의된 규칙 |
| `pattern` | 반복 설계 패턴 |
| `concept` | 개념 정의 |
| `proposal` | 확정 전 제안/RFC |
| `template` | 생성 템플릿 |

## 제약 ^constraint

- `type: knowledge`에는 필수다.
- `type: design`/`spec`에는 사용할 수 없다.
- proposal/adr/convention은 의도적 좌표 co-location을 허용하는 validator 예외가 있다.
