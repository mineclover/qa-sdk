---
def:
  tier: component
  id: gate-ingest-test
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: ingest-quality-contract
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: ING-QUALITY-001
  package: ingest-server
  command: pnpm --filter @qa-sdk/ingest-server test
  successPattern: exit_code=0
  references: [packages/ingest-server/src/app.test.ts, packages/ingest-server/src/routes/ingest.test.ts, packages/ingest-server/src/lib/phase-two-worker.test.ts]
  suggestOnFail: [gate-ingest-build]
sources:
  - packages/ingest-server/src/app.test.ts
  - packages/ingest-server/src/routes/ingest.test.ts
  - packages/ingest-server/src/lib/phase-two-worker.test.ts
---
# Ingest Test Gate


## 탐색 ^navigation

quality-gates-system > ingest-quality-bundle > **gate-ingest-test**

형제: `ingest-quality-contract` · `gate-ingest-build` · `gate-ingest-sdk-bridge`

## 목적 ^purpose

`ingest-server`의 route, worker, convergence, insights, query/verdict 경로가 테스트 수준에서 유지되는지 검증하는 게이트.
