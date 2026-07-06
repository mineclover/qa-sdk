---
def:
  id: decision-service-spec
  type: spec
  tier: system
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-service
  links:
    - target: decision-service-system
      type: depends_on
sources:
  - packages/decision-service/src/app.module.ts
  - packages/decision-service/src/database.module.ts
  - packages/decision-service/src/db/schema.ts
  - packages/decision-service/scripts/services.test.ts
---
# Decision Service Spec
## 목적 ^purpose
전체 시스템의 의사결정 흐름을 추적하고, 결정 상태와 근거 데이터를 영속화한다.
