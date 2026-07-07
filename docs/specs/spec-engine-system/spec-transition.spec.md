---
def:
  id: spec-transition
  type: spec
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-transition
  tags: [fsm, transition, declarative]
  links:
    - target: spec-architecture-system
      type: refines
sources:
  - packages/spec-transition/src/index.ts
  - packages/spec-transition/src/transition.schema.ts
  - packages/spec-transition/src/transition.registry.ts
  - packages/spec-transition/src/transition-engine.ts
  - packages/spec-transition/src/transition.test.ts
  - packages/spec-transition/src/transition-engine.test.ts
---

# spec-transition — Transition Spec DSL

## 목적 ^purpose

좌표 축 위 상태 전이(FSM)를 선언형 DSL로 정의하고 실행하는 엔진. transition은 비즈니스 원자 경계의 설계 선언이며 구현 메커니즘과 분리된다. `spec-core`의 상태 진행 축과 `decision-flow`의 의사결정 단계에서 공통 사용.
