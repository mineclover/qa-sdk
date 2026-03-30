---
def:
  id: gate-decision-flow-build
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:build, work-domain:productivity]
  links:
    - target: decision-flow-quality-contract
      type: depends_on
gate:
  kind: build
  workDomain: productivity
  storyId: DF-QUALITY-001
  package: decision-flow
  command: pnpm --filter decision-flow build
  successPattern: exit_code=0
  references: [packages/decision-flow/package.json]
  suggestOnPass: [gate-decision-flow-test]
  suggestOnFail: [gate-decision-flow-typecheck]
---
# Decision Flow Build Gate


## 탐색 ^navigation

quality-gates-system > decision-flow-quality-bundle > **gate-decision-flow-build**

형제: `decision-flow-quality-contract` · `gate-decision-flow-typecheck` · `gate-decision-flow-test`

## 목적 ^purpose

`decision-flow` package가 ESM/CJS/DTS 산출물을 정상 생성하는지 확인하는 빌드 게이트.
