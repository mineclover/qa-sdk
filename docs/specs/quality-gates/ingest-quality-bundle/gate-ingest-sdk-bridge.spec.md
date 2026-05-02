---
def:
  tier: component
  id: gate-ingest-sdk-bridge
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: ingest-quality-contract
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: ING-QUALITY-001
  package: ingest-server
  command: pnpm --filter @qa-sdk/ingest-server exec vitest run src/sdk-to-ingest.e2e.test.ts
  successPattern: exit_code=0
  references: [packages/ingest-server/src/sdk-to-ingest.e2e.test.ts, packages/ingest-server/src/routes/ingest.ts]
---
# Ingest SDK Bridge Gate


## 탐색 ^navigation

quality-gates-system > ingest-quality-bundle > **gate-ingest-sdk-bridge**

형제: `ingest-quality-contract` · `gate-ingest-build` · `gate-ingest-test`

## 목적 ^purpose

SDK에서 생성한 envelope이 ingest route를 통해 실제로 수신/저장되는 경로를 검증하는 통합 게이트.
