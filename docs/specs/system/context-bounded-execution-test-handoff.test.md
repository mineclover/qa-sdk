---
def:
  id: context-bounded-execution-test-handoff
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
  - packages/context-runtime/src/decomposition.test.ts
  - packages/context-runtime/src/handoff-execution.test.ts
  - packages/context-runtime/src/handoff.test.ts
  - packages/cli/src/lib/context-runtime/task-handoff-store.test.ts
  - packages/context-runtime/src/decomposition.ts:executeDiscoveryTaskDecomposition
  - packages/context-runtime/src/handoff.ts:executeAndAggregateTaskHandoffs
  - packages/context-runtime/src/handoff.ts:createTaskHandoff
  - packages/context-runtime/src/handoff.ts:aggregateTaskHandoffs
---
# Context-Bounded Execution — Decomposition·Handoff 검증

## 목적 ^purpose

child task 실행, reference-only handoff, persistence와 aggregation의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-decomposition-executor
    contract: context-runtime.decomposition.executor.v1
    level: unit
    assertions:
      [
        then.returns.child_tasks,
        then.returns.parent_status,
        then.invariants.failure_never_claims_parent_completed,
        then.invariants.skipped_children_are_explicit,
      ]
    test_file: packages/context-runtime/src/decomposition.test.ts

  - id: TU-context-runtime-handoff-execution
    contract: context-runtime.handoff.execution.v1
    level: unit
    assertions:
      [
        then.returns.execution,
        then.returns.parent_handoff,
        then.invariants.partial_execution_has_no_parent_handoff,
        then.invariants.child_execution_order_is_deterministic,
      ]
    test_file: packages/context-runtime/src/handoff-execution.test.ts

  - id: TU-context-runtime-reference-only-handoff
    contract: context-runtime.handoff.reference-only.v1
    level: unit
    assertions:
      [
        then.returns.handoff,
        then.returns.evidence_refs,
        then.invariants.handoff.excludes_conversation_transcript,
      ]
    test_file: packages/context-runtime/src/handoff.test.ts

  - id: TU-context-runtime-handoff-persistence
    contract: context-runtime.handoff.persistence.v1
    level: integration
    assertions:
      [
        then.returns.handoff,
        then.returns.task_history,
        then.invariants.duplicate_handoff_save_is_idempotent,
        then.invariants.handoff_store_excludes_conversation_transcript,
      ]
    test_file: packages/cli/src/lib/context-runtime/task-handoff-store.test.ts

  - id: TU-context-runtime-handoff-aggregation
    contract: context-runtime.handoff.aggregate.v1
    level: unit
    assertions:
      [
        then.returns.parent_handoff,
        then.returns.child_task_keys,
        then.returns.fact_refs,
        then.invariants.missing_or_extra_children_fail_closed,
        then.invariants.conflicting_fact_revisions_fail_closed,
        then.invariants.parent_digest_is_deterministic,
        then.invariants.handoff_excludes_fact_values,
      ]
    test_file: packages/context-runtime/src/handoff.test.ts
implementation_units:
  - id: IU-context-runtime-decomposition-executor
    contract: context-runtime.decomposition.executor.v1
    unit_kind: operation
    owned_by: context-runtime
    source_target: packages/context-runtime/src/decomposition.ts:executeDiscoveryTaskDecomposition
    effects: [discovery.child_task_execution, discovery.parent_execution_status]

  - id: IU-context-runtime-handoff-execution
    contract: context-runtime.handoff.execution.v1
    unit_kind: operation
    owned_by: context-runtime
    source_target: packages/context-runtime/src/handoff.ts:executeAndAggregateTaskHandoffs
    effects: [child.handoff_execution, parent.task_handoff]

  - id: IU-context-runtime-task-handoff
    contract: context-runtime.handoff.reference-only.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/handoff.ts:createTaskHandoff
    effects: [typed.task.handoff]

  - id: IU-context-runtime-task-handoff-aggregation
    contract: context-runtime.handoff.aggregate.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/handoff.ts:aggregateTaskHandoffs
    effects: [parent.task_handoff, parent.manifest_digest, parent.fact_references]
```
