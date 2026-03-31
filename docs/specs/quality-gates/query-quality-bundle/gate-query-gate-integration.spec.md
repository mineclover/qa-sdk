---
def:
  id: gate-query-gate-integration
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: query-quality-contract
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: QRY-QUALITY-001
  package: query-service
  command: pnpm --filter query-service exec vitest run src/lib/gate-client.test.ts src/app.test.ts
  successPattern: exit_code=0
  references: [packages/query-service/src/lib/gate-client.ts, packages/query-service/src/routes/query.ts]
---
# Query Gate Integration Gate


## 탐색 ^navigation

quality-gates-system > query-quality-bundle > **gate-query-gate-integration**

형제: `query-quality-contract` · `gate-query-build` · `gate-query-test`

## 목적 ^purpose

`query-service`의 gate-client와 query route가 gate-service 상태를 반영해 resolve/filter를 수행하는 경로를 검증하는 통합 게이트.
