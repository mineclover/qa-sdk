---
def:
  tier: component
  id: gate-definition-service-sync
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: definition-service-quality-contract
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: DEF-SVC-QUALITY-001
  package: definition-service
  command: pnpm --filter definition-catalog exec vitest run src/scan-real.test.ts
  successPattern: exit_code=0
  references: [packages/definition-catalog/src/scan-real.test.ts, packages/definition-service/src/modules/sync/sync.service.ts]
  suggestOnPass: [gate-definition-service-context]
sources:
  - packages/definition-catalog/src/scan-real.test.ts
  - packages/definition-service/src/modules/sync/sync.service.ts
---
# Definition Service Sync Gate


## 탐색 ^navigation

quality-gates-system > definition-service-quality-bundle > **gate-definition-service-sync**

형제: `definition-service-quality-contract` · `gate-definition-service-build` · `gate-definition-service-context`

## 목적 ^purpose

문서 스캔과 file→DB 동기화 전제가 실제 docs 그래프에서 깨지지 않았는지 검증하는 통합 게이트.
