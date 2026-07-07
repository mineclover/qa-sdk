---
def:
  id: infra-engine-system
  type: spec
  tier: system
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: infra-engine
  links:
    - target: infra-engine-system-rule
      type: traces_to
sources:
  - packages/infra-engine/README.md
  - packages/infra-engine/src/index.ts
  - packages/infra-engine/src/core/types.ts
  - packages/infra-engine/src/core/pipeline.ts
  - packages/infra-engine/__tests__/core/pipeline.test.ts
---
# Infra Engine System
## 목적 ^purpose
클라우드 자원 할당, 배포 파이프라인 제어 및 인프라 정합성 검증을 담당한다.
