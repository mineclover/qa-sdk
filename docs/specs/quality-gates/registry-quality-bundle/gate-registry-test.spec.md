---
def:
  id: gate-registry-test
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: registry-quality-contract
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: REG-QUALITY-001
  package: registry-service
  command: pnpm --filter @qa-sdk/registry-service exec vitest run src/app.test.ts --testTimeout=15000
  successPattern: exit_code=0
  references: [packages/registry-service/src/app.test.ts]
  suggestOnFail: [gate-registry-build]
---
# Registry Test Gate


## 탐색 ^navigation

quality-gates-system > registry-quality-bundle > **gate-registry-test**

형제: `registry-quality-contract` · `gate-registry-build` · `gate-registry-service-flow`

## 목적 ^purpose

`registry-service`의 app-level HTTP surface가 테스트 수준에서 유지되는지 검증하는 게이트.
