---
def:
  tier: component
  id: gate-decision-flow-test
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: decision-flow-quality-contract
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: DF-QUALITY-001
  package: decision-flow
  command: pnpm --filter decision-flow test
  successPattern: exit_code=0
  references: [packages/decision-flow/src/decision-flow.test.ts, packages/decision-flow/src/observe.test.ts, packages/decision-flow/src/core-analysis.test.ts]
  suggestOnFail: [gate-decision-flow-build]
---
# Decision Flow Test Gate


## 탐색 ^navigation

quality-gates-system > decision-flow-quality-bundle > **gate-decision-flow-test**

형제: `decision-flow-quality-contract` · `gate-decision-flow-typecheck` · `gate-decision-flow-build`

## 목적 ^purpose

`decision-flow`의 schema/engine/observe/comparison/policy 핵심 동작이 테스트 수준에서 유지되는지 검증하는 단위 테스트 게이트.
