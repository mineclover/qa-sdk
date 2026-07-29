---
def:
  id: skill-spec-lifecycle-test
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: experience
  family_id: docs/specs/skill-catalog/automation-skill-group/skill-spec-lifecycle
  tags: [documentation, tooling, testing]
  links:
    - target: skill-spec-lifecycle
      type: refines
    - target: skill-spec-lifecycle-cases
      type: traces_to
sources:
  - packages/cli/src/skills-workflows.test.ts
  - packages/cli/src/commands/docs.test.ts
  - packages/cli/src/commands/def.lifecycle.test.ts
  - packages/cli/src/commands/def.context.test.ts
  - packages/cli/src/commands/def.quality.test.ts
---

# Spec Lifecycle — 도구 선택 검증

## 목적 ^purpose

spec-lifecycle 운영 가이드가 실제 CLI command tree와 분리되지 않도록, lifecycle에 필요한
`docs`/`def` command entrypoint와 문서 표기를 하나의 test unit으로 검증한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-skill-spec-lifecycle-tool-map
    contract: docs-control-plane.spec-lifecycle.inspect-family.v1
    level: unit
    assertions:
      [then.returns.document.lifecycle, then.returns.family.role_coverage, then.invariants.no_document_mutation]
    test_file: packages/cli/src/skills-workflows.test.ts

  - id: TU-skill-spec-lifecycle-status-runtime
    contract: docs-control-plane.spec-lifecycle.inspect-family.v1
    level: unit
    assertions:
      [then.returns.document.lifecycle, then.returns.family.role_coverage]
    test_file: packages/cli/src/commands/docs.test.ts

  - id: TU-skill-spec-lifecycle-closure-command
    contract: docs-control-plane.spec-lifecycle.inspect-closure.v1
    level: unit
    assertions:
      [then.returns.closure.responsibility, then.returns.closure.evidence, then.returns.closure.missing]
    test_file: packages/cli/src/skills-workflows.test.ts

  - id: TU-skill-spec-lifecycle-closure-runtime
    contract: docs-control-plane.spec-lifecycle.inspect-closure.v1
    level: unit
    assertions:
      [then.returns.closure.responsibility, then.returns.closure.evidence, then.returns.closure.missing]
    test_file: packages/cli/src/commands/docs.test.ts

  - id: TU-skill-spec-lifecycle-final-closure-order
    contract: docs-control-plane.spec-lifecycle.confirm-final-closure.v1
    level: unit
    assertions:
      [then.returns.closure.missing, then.returns.closure.diagnostics, then.invariants.closure_rechecked_after_source_mapping]
    test_file: packages/cli/src/skills-workflows.test.ts

  - id: TU-skill-spec-lifecycle-source-coverage-command
    contract: docs-control-plane.spec-lifecycle.inspect-source-coverage.v1
    level: unit
    assertions:
      [then.returns.source.coverage_rate, then.returns.source.unlinked_files, then.invariants.explicit_mapping_only]
    test_file: packages/cli/src/skills-workflows.test.ts

  - id: TU-skill-spec-lifecycle-source-coverage-runtime
    contract: docs-control-plane.spec-lifecycle.inspect-source-coverage.v1
    level: unit
    assertions:
      [then.returns.source.coverage_rate, then.returns.source.unlinked_files]
    test_file: packages/cli/src/commands/def.quality.test.ts

implementation_units:
  - id: IU-docs-status-entrypoint
    contract: docs-control-plane.spec-lifecycle.inspect-family.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts:cliDocs
    effects: [docs.status_projection]

  - id: IU-docs-closure-entrypoint
    contract: docs-control-plane.spec-lifecycle.inspect-closure.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts:cliDocs
    effects: [docs.closure_projection]

  - id: IU-def-source-coverage-entrypoint
    contract: docs-control-plane.spec-lifecycle.inspect-source-coverage.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def/quality.ts:cmdCodeLinkGaps
    effects: [source.coverage_projection, source.explicit_mapping_only]

  - id: IU-docs-final-closure-entrypoint
    contract: docs-control-plane.spec-lifecycle.confirm-final-closure.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts:cliDocs
    effects: [docs.final_closure_projection]
```
