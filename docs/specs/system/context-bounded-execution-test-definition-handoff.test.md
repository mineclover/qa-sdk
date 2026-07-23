---
def:
  id: context-bounded-execution-test-definition-handoff
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
---
# Context-Bounded Execution — Definition handoff 검증

## 목적 ^purpose

Definition child 결과의 discovery/read-model 분리와 handoff persistence·aggregation의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-docs-control-plane-handoff-aggregation
    contract: docs-control-plane.definition-context.handoff-aggregation.v1
    level: integration
    assertions:
      [
        then.returns.handoff,
        then.returns.store_file,
        then.invariants.child_revision_ambiguity_fails_closed,
        then.invariants.parent_child_keys_are_persisted,
      ]
    test_file: packages/cli/src/commands/def.test.ts

  - id: TU-docs-control-plane-handoff-execution
    contract: docs-control-plane.definition-context.handoff-execution.v1
    level: integration
    assertions:
      [
        then.returns.execution,
        then.returns.parent_handoff,
        then.invariants.partial_child_execution_blocks_parent_handoff,
        then.invariants.source_work_is_callback_owned,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-discovery-result-policy
    contract: docs-control-plane.definition-context.discovery-result-policy.v1
    level: integration
    assertions:
      [
        then.returns.discovery_refs,
        then.returns.parent_handoff,
        then.invariants.discovery_refs_never_become_facts,
        then.invariants.resolution_handoff_child_keys_are_explicit,
        then.invariants.partial_mixed_execution_has_no_parent_handoff,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-handoff-aggregate-discovery-results
    contract: docs-control-plane.def.handoff-aggregate.discovery-results.v1
    level: integration
    assertions:
      [
        then.returns.handoff,
        then.returns.discovery_refs,
        then.invariants.discovery_refs_never_become_facts,
        then.invariants.discovery_child_keys_are_not_parent_handoff_keys,
      ]
    test_file: packages/cli/src/commands/def.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-handoff-persistence
    contract: docs-control-plane.definition-context.handoff-persistence.v1
    level: integration
    assertions:
      [
        then.returns.handoff,
        then.returns.store_file,
        then.invariants.result_revision_is_explicit,
        then.invariants.handoff_excludes_fact_values,
      ]
    test_file: packages/cli/src/commands/def.test.ts
implementation_units:
  - id: IU-docs-control-plane-task-handoff-store
    contract: docs-control-plane.definition-context.handoff-persistence.v1
    unit_kind: repository
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/task-handoff-store.ts:JsonTaskHandoffStore
    effects: [task.handoff.persisted, task.handoff.retrieved]

  - id: IU-docs-control-plane-task-handoff-query
    contract: docs-control-plane.definition-context.handoff-persistence.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def.ts:cmdHandoff
    effects: [task.handoff.retrieved]

  - id: IU-docs-control-plane-task-handoff-aggregation
    contract: docs-control-plane.definition-context.handoff-aggregation.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def.ts:cmdHandoffAggregate
    effects: [parent.task_handoff, parent.task_handoff_store]

  - id: IU-docs-control-plane-handoff-execution
    contract: docs-control-plane.definition-context.handoff-execution.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:executeDefinitionTaskDecomposition
    effects: [definition.child_handoff_execution, definition.parent_handoff]

  - id: IU-docs-control-plane-discovery-result-policy
    contract: docs-control-plane.definition-context.discovery-result-policy.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:executeDefinitionTaskDecompositionWithDiscovery
    effects: [definition.discovery_refs, definition.resolution_parent_handoff]

  - id: IU-docs-control-plane-handoff-aggregate-discovery-results
    contract: docs-control-plane.def.handoff-aggregate.discovery-results.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def.ts:cmdHandoffAggregate
    effects: [definition.discovery_refs, definition.task_handoff_store]

  - id: IU-docs-control-plane-bounded-context-handoff-persistence
    contract: docs-control-plane.definition-context.handoff-persistence.v1
    unit_kind: repository
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def.ts:persistDefinitionTaskHandoff
    effects: [definition.task_handoff, definition.task_handoff_store]
```
