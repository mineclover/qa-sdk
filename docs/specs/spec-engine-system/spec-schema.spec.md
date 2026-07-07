---
def:
  id: spec-schema
  type: spec
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-schema
  tags: [schema, validation]
  links:
    - target: spec-architecture-system
      type: refines
sources:
  - packages/spec-schema/src/index.ts
  - packages/spec-schema/src/schema.registry.ts
  - packages/spec-schema/src/schema.validator.ts
  - packages/spec-schema/src/category-rules.ts
  - packages/spec-schema/src/schema.test.ts
---

# spec-schema — Layer 2 스키마 시스템

## 목적 ^purpose

6종 스펙 카테고리(structure/behavior/contract/quality/decision/knowledge)의 스키마 정의, 검증 규칙, 프리셋을 소유하는 라이브러리. `spec-core`의 내부 구조를 프레임 잡고, `spec-analyzer`·`spec-tracker`가 본 스키마를 기준으로 문서·코드를 분류한다.
