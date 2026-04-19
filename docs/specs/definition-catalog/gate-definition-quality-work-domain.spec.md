---
def:
  id: gate-definition-quality-work-domain
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: definition-quality-gates
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: DQ-QUALITY-001
  package: work-domain
  command: pnpm --filter work-domain test
  successPattern: exit_code=0
  references: [packages/work-domain/src/harness.ts, packages/work-domain/src/harness.test.ts]
---
# Definition Quality Gates — Work Domain Gate

## 목적 ^purpose

`definition-quality-gates`가 의존하는 `work-domain`의 하네스/게이트 FSM 로직이 깨지지 않았는지 검증하는 단위 테스트 게이트.
