---
def:
  id: gate-query-test
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: query-quality-contract
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: QRY-QUALITY-001
  package: query-service
  command: pnpm --filter query-service test
  successPattern: exit_code=0
  references: [packages/query-service/src/app.test.ts, packages/query-service/src/stores/policy-rule-store.test.ts]
  suggestOnFail: [gate-query-build]
---
# Query Test Gate


## 탐색 ^navigation

quality-gates-system > query-quality-bundle > **gate-query-test**

형제: `query-quality-contract` · `gate-query-build` · `gate-query-gate-integration`

## 목적 ^purpose

`query-service`의 app/query/rules/store 핵심 동작이 테스트 수준에서 유지되는지 검증하는 게이트.
