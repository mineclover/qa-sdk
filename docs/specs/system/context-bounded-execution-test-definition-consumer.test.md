---
def:
  id: context-bounded-execution-test-definition-consumer
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  family_id: docs/specs/system/context-bounded-execution
  tags: [testing, architecture, context]
  links:
    - target: context-bounded-execution-test
      type: refines
sources:
  - packages/cli/src/commands/def.context.test.ts
  - packages/cli/src/lib/context-runtime/definition-document-context.ts:buildBoundedDefinitionContext
  - packages/cli/src/commands/def.ts:cmdContext
  - packages/context-runtime/src/discovery.ts:createDiscoveryTaskDecomposition
---
# Context-Bounded Execution — Definition consumer 검증

## 목적 ^purpose

definition graph bounded consumer의 정상·blocked·decomposition 경로 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-docs-control-plane-bounded-definition-context
    contract: docs-control-plane.definition-context.bounded-consumer.v1
    level: integration
    assertions:
      [
        then.returns.bounded.mode,
        then.returns.discovery.plan,
        then.returns.working_context.status,
        then.returns.manifest.digest,
        then.returns.observation.event,
        then.invariants.default_context_output_unchanged,
        then.invariants.manifest_excludes_fact_values,
      ]
    test_file: packages/cli/src/commands/def.context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-blocked
    contract: docs-control-plane.definition-context.bounded-blocked.v1
    level: integration
    assertions:
      [
        then.returns.working_context.status,
        then.returns.manifest,
        then.returns.observation.status,
        then.invariants.working_reserve_preserved,
        then.invariants.no_manifest_for_blocked_context,
      ]
    test_file: packages/cli/src/commands/def.context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-decomposition
    contract: docs-control-plane.definition-context.decomposition.v1
    level: integration
    assertions:
      [
        then.returns.discovery.next_action,
        then.returns.discovery.decomposition.children,
        then.invariants.child_route_keys_are_explicit,
      ]
    test_file: packages/cli/src/commands/def.context.test.ts
implementation_units:
  - id: IU-docs-control-plane-bounded-definition-context
    contract: docs-control-plane.definition-context.bounded-consumer.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:buildBoundedDefinitionContext
    effects:
      [
        definition.discovery_plan,
        definition.working_context,
        definition.context_manifest,
        definition.context_observation,
      ]

  - id: IU-docs-control-plane-bounded-context-command
    contract: docs-control-plane.definition-context.bounded-consumer.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def.ts:cmdContext
    effects: [def.context.bounded_output]

  - id: IU-docs-control-plane-bounded-context-decomposition
    contract: docs-control-plane.definition-context.decomposition.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/context-runtime/src/discovery.ts:createDiscoveryTaskDecomposition
    effects: [definition.decomposition_plan, definition.child_task_slices]
```
