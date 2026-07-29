---
def:
  id: context-bounded-execution-cases-planning-core
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
  - packages/context-runtime/src/discovery.ts
  - packages/context-runtime/src/working-context.ts
---
# Context-Bounded Execution — 예산·Route 계약

## 목적 ^purpose

예산 격리, route freeze와 authoritative fact 해소를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: context-runtime.budget.reserve-isolation.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [budget.working_reserve_is_100k, discovery.has_optional_expansion]
      fixtures: [context-runtime.fixture.default-200k-profile]
    when:
      operation: context-runtime.planDiscovery
    then:
      returns:
        discovery.max_tokens: 100000
        working.reserve_tokens: 100000
      invariants: [budget.no_borrow_from_working, budget.system_and_output_reserve_preserved]

  - id: context-runtime.discovery.plan-routes.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates:
        [task.intent_available, discovery.candidate_routes_present, budget.working_reserve_is_100k]
      fixtures: [context-runtime.fixture.order-release-candidates]
    when:
      operation: context-runtime.planDiscovery
    then:
      returns:
        discovery.plan: deterministic
        candidate.projections: cost_authority_freshness_size
      invariants:
        [
          selected_routes_have_bounds,
          discovery.does_not_borrow_working_reserve,
          same_input_same_plan,
        ]

  - id: context-runtime.discovery-to-working.route-freeze.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [discovery.context_map_available, discovery.candidate_routes_present]
      fixtures: [context-runtime.fixture.order-release-map]
    when:
      operation: context-runtime.freezeRouteSelection
    then:
      returns:
        selected_routes: non_empty
        working_context: not_yet_loaded
      invariants: [discovery.summary_not_fact, selected_routes_have_bounds]

  - id: context-runtime.working.resolve-authoritative-facts.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates:
        [
          route.selection_frozen,
          required_facts.have_resolution_routes,
          facts.authority_and_freshness_valid,
        ]
      fixtures: [context-runtime.fixture.order-release-authoritative-facts]
    when:
      operation: context-runtime.compileWorkingContext
    then:
      returns:
        working_context.status: closed
        working_context.facts: authoritative_only
        working_context.allowed_operations: present
        working_context.output_contract: present
        manifest: present
      invariants: [working_context.contains_revisions, working_context.contains_evidence_refs]
```
