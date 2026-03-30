---
def:
  id: gate-registry-service-flow
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: registry-quality-contract
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: REG-QUALITY-001
  package: registry-service
  command: pnpm --filter @qa-sdk/registry-service exec vitest run src/e2e/catalog-and-services.test.ts src/stores/prefix-owner-store.test.ts src/lib/draft-workspace.test.ts src/lib/gate-hook-integration.test.ts src/lib/activation-gate-adapter.test.ts --testTimeout=15000
  successPattern: exit_code=0
  references: [packages/registry-service/src/e2e/catalog-and-services.test.ts, packages/registry-service/src/stores/prefix-owner-store.test.ts, packages/registry-service/src/lib/registry-service.ts]
---
# Registry Service Flow Gate


## 탐색 ^navigation

quality-gates-system > registry-quality-bundle > **gate-registry-service-flow**

형제: `registry-quality-contract` · `gate-registry-build` · `gate-registry-test`

## 목적 ^purpose

catalog/service/workspace/hook 흐름이 실제 테스트에서 유지되는지 검증하는 통합 게이트.
