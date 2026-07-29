---
def:
  id: context-bounded-execution-cases-handoff
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  family_id: docs/specs/system/context-bounded-execution
  tags: [scenario, testing, architecture, context]
  links:
    - target: context-bounded-execution-cases
      type: refines
sources:
  - packages/context-runtime/src/handoff.ts
  - packages/context-runtime/src/decomposition.ts
  - packages/cli/src/lib/context-runtime/task-handoff-store.ts
---
# Context-Bounded Execution — Decomposition·Handoff 계약

## 목적 ^purpose

child task 실행, reference-only handoff, persistence와 aggregation 경계를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: context-runtime.decomposition.executor.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [discovery.decomposition_available, child_route_slices_are_explicit]
      fixtures: [context-runtime.fixture.discovery-overflow]
    when:
      operation: context-runtime.executeDiscoveryTaskDecomposition
    then:
      returns:
        child_tasks: sequential_results
        parent_status: completed_partial_or_failed
      invariants:
        [
          child_tasks_do_not_share_mutable_context,
          failure_never_claims_parent_completed,
          skipped_children_are_explicit,
        ]

  - id: context-runtime.handoff.execution.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [decomposition.children_present, child_handoff_executor_available]
      fixtures: [context-runtime.fixture.completed-child-handoffs]
    when:
      operation: context-runtime.executeAndAggregateTaskHandoffs
    then:
      returns:
        execution: sequential_child_results
        parent_handoff: present_only_when_all_children_complete
      invariants:
        [
          partial_execution_has_no_parent_handoff,
          child_execution_order_is_deterministic,
          parent_aggregation_remains_reference_only,
        ]

  - id: context-runtime.handoff.reference-only.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [working_context.closed, task.outcome_recorded]
      fixtures: [context-runtime.fixture.completed-order-release]
    when:
      operation: context-runtime.createTaskHandoff
    then:
      returns:
        handoff: typed
        evidence_refs: non_empty
      invariants:
        [handoff.excludes_conversation_transcript, handoff.preserves_revisions_and_manifest_digest]

  - id: context-runtime.handoff.aggregate.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [decomposition.children_present, one_completed_handoff_per_child]
      fixtures: [context-runtime.fixture.completed-child-handoffs]
    when:
      operation: context-runtime.aggregateTaskHandoffs
    then:
      returns:
        parent_handoff: typed_reference_only
        child_task_keys: preserved
        fact_refs: merged_by_key_and_revision
      invariants:
        [
          missing_or_extra_children_fail_closed,
          conflicting_fact_revisions_fail_closed,
          evidence_refs_are_union_and_deterministic,
          parent_digest_is_deterministic,
          handoff_excludes_fact_values,
        ]

  - id: context-runtime.handoff.persistence.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [typed_handoff_available, handoff_store_available]
      fixtures: [context-runtime.fixture.completed-order-release]
    when:
      operation: context-runtime.TaskHandoffStore.save_then_findByTaskKey
    then:
      returns:
        handoff: persisted_and_retrievable
        task_history: distinct_result_revisions_preserved
      invariants:
        [duplicate_handoff_save_is_idempotent, handoff_store_excludes_conversation_transcript]
```
