---
def:
  id: context-bounded-execution-cases-definition-handoff
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
---
# Context-Bounded Execution — Definition handoff 계약

## 목적 ^purpose

Definition child 결과의 discovery/read-model 분리와 handoff persistence·aggregation을 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.definition-context.handoff-execution.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [decomposition_available, child_handoff_executor_injected]
      fixtures: [definition-context.fixture.completed-child-handoffs]
    when:
      operation: docs-control-plane.executeDefinitionTaskDecomposition
    then:
      returns:
        execution: sequential_child_results
        parent_handoff: present_only_when_all_children_complete
      invariants: [partial_child_execution_blocks_parent_handoff, source_work_is_callback_owned]

  - id: docs-control-plane.definition-context.discovery-result-policy.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [mixed_discovery_and_resolution_children, child_executor_available]
      fixtures: [definition-context.fixture.mixed-child-results]
    when:
      operation: docs-control-plane.executeDefinitionTaskDecompositionWithDiscovery
    then:
      returns:
        discovery_refs: separate_read_model
        parent_handoff: resolution_children_only
      invariants:
        [
          discovery_refs_never_become_facts,
          resolution_handoff_child_keys_are_explicit,
          partial_mixed_execution_has_no_parent_handoff,
        ]

  - id: docs-control-plane.definition-context.handoff-persistence.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [bounded_context.closed, result_revision_declared, local_handoff_store_available]
      fixtures: [definition-context.fixture.definition-addressing]
    when:
      operation: docs-control-plane.def.context.bounded.persistHandoff
    then:
      returns:
        handoff: typed_reference_only
        store_file: versioned_json
      invariants:
        [
          blocked_context_cannot_persist_handoff,
          result_revision_is_explicit,
          handoff_excludes_fact_values,
        ]

  - id: docs-control-plane.definition-context.handoff-aggregation.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [decomposition_json_available, exactly_one_handoff_per_child]
      fixtures: [definition-context.fixture.completed-child-handoffs]
    when:
      operation: docs-control-plane.def.handoff-aggregate
    then:
      returns:
        handoff: parent_reference_only
        store_file: versioned_json
      invariants:
        [
          child_revision_ambiguity_fails_closed,
          parent_child_keys_are_persisted,
          parent_handoff_excludes_fact_values,
        ]

  - id: docs-control-plane.def.handoff-aggregate.discovery-results.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [decomposition_json_available, mixed_discovery_and_resolution_children]
      fixtures: [definition-context.fixture.mixed-child-results]
    when:
      operation: docs-control-plane.def.handoff-aggregate
    then:
      returns:
        handoff: resolution_children_only
        discovery_refs: separate_read_model
      invariants:
        [discovery_refs_never_become_facts, discovery_child_keys_are_not_parent_handoff_keys]
```
