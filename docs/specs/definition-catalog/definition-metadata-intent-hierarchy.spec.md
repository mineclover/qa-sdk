---
def:
  id: definition-metadata-intent-hierarchy
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

# Definition Metadata — `intent_hierarchy`

## 목적 ^purpose

`def.intent_hierarchy`는 설계 의도가 core인지 auxiliary인지 구분한다. core는 책임의 본질이고 auxiliary는 support/sidecar다.

## 정의 ^defines

| value | 의미 | 변경 판단 |
|-------|------|-----------|
| `core` | 시스템 본질, behavior truth, 핵심 정책 | 변경 시 owner/root 영향 검토 |
| `auxiliary` | 운영 보조, 편의 projection, sidecar | core와 분리해 fail-open 가능 |

## 제약 ^constraint

- auxiliary가 core behavior를 직접 바꾸면 분류 오류다.
- core 문서가 auxiliary 구현 상세를 장문 소유하면 책임 분리 대상이다.
