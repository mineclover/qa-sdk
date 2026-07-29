---
def:
  id: context-bounded-execution-cases-definition-consumer
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
  - packages/cli/src/commands/def/context-handoff.ts
  - packages/cli/src/commands/def.context.test.ts
---
# Context-Bounded Execution — Definition consumer 계약

## 목적 ^purpose

definition graph를 bounded context consumer로 사용하는 정상·blocked·decomposition 경로를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.definition-context.bounded-consumer.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates:
        [
          definition.document_exists,
          definition.graph_context_available,
          context.runtime_budget_available,
        ]
      fixtures: [definition-context.fixture.definition-addressing]
    when:
      operation: docs-control-plane.def.context.bounded
    then:
      returns:
        bounded.mode: true
        discovery.plan: present
        working_context.status: closed
        manifest.digest: present
        observation.event: typed
      invariants:
        [
          default_context_output_unchanged,
          discovery_summary_not_fact,
          working_facts_have_revisions,
          manifest_excludes_fact_values,
        ]

  - id: docs-control-plane.definition-context.bounded-blocked.v1
    owner_system: docs-control-plane
    contract_kind: validation-failure
    mode: read
    given:
      predicates:
        [definition.document_exists, discovery.used_tokens_at_cap, required_fact_route_not_selected]
      fixtures: [definition-context.fixture.definition-addressing]
    when:
      operation: docs-control-plane.def.context.bounded
    then:
      error:
        code: context-closure-incomplete
      returns:
        working_context.status: blocked
        manifest: absent
        observation.status: blocked
      invariants:
        [working_reserve_preserved, no_execution_context_emitted, no_manifest_for_blocked_context]

  - id: docs-control-plane.definition-context.decomposition.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [definition.document_exists, discovery.used_tokens_at_cap, skipped_routes_present]
      fixtures: [definition-context.fixture.definition-addressing]
    when:
      operation: docs-control-plane.def.context.bounded
    then:
      returns:
        discovery.next_action: decompose
        discovery.decomposition.children: deterministic_route_slices
      invariants:
        [
          decomposition_does_not_read_source_payloads,
          child_tasks_retain_parent_anchor,
          child_route_keys_are_explicit,
        ]
```
