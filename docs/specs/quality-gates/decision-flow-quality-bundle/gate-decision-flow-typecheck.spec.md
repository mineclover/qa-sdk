---
def:
  tier: component
  id: gate-decision-flow-typecheck
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:typecheck, work-domain:productivity]
  links:
    - target: decision-flow-quality-contract
      type: depends_on
gate:
  kind: typecheck
  workDomain: productivity
  storyId: DF-QUALITY-001
  package: decision-flow
  command: pnpm --filter decision-flow typecheck
  successPattern: exit_code=0
  references: [packages/decision-flow/src/schema.ts, packages/decision-flow/src/types.ts]
  suggestOnPass: [gate-decision-flow-build]
sources:
  - packages/decision-flow/src/schema.ts
  - packages/decision-flow/src/types.ts
---
# Decision Flow Typecheck Gate


## 탐색 ^navigation

quality-gates-system > decision-flow-quality-bundle > **gate-decision-flow-typecheck**

형제: `decision-flow-quality-contract` · `gate-decision-flow-build` · `gate-decision-flow-test`

## 목적 ^purpose

`decision-flow`의 공개 타입과 schema/engine surface가 TypeScript 수준에서 깨지지 않았는지 먼저 검증하는 정적 게이트.
