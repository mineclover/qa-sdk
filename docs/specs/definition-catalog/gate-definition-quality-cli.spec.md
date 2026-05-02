---
def:
  id: gate-definition-quality-cli
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: definition-quality-gates
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: DQ-QUALITY-001
  package: cli
  command: pnpm --filter @qa-sdk/cli exec vitest run src/commands/quality.test.ts
  successPattern: exit_code=0
  references: [packages/cli/src/commands/quality.ts, packages/cli/src/commands/quality.test.ts]
---
# Definition Quality Gates — CLI Gate

## 목적 ^purpose

`definition-quality-gates`의 사용자 진입점인 `qa-sdk quality` 구현과 claim audit helper가 CLI 테스트 수준에서 유지되는지 검증하는 게이트.
