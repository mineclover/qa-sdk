---
def:
  id: gate-definition-quality-spec-tracker
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
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: definition-quality-gates
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: DQ-QUALITY-001
  package: spec-tracker
  command: pnpm --filter spec-tracker test
  successPattern: exit_code=0
  references: [packages/spec-tracker/src/claim-audit.ts, packages/spec-tracker/src/claim-audit.test.ts]
---
# Definition Quality Gates — Spec Tracker Gate

## 목적 ^purpose

`definition-quality-gates`가 사용하는 claim extractor/audit 로직이 기대 verdict를 유지하는지 검증하는 단위 테스트 게이트.
