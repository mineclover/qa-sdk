---
def:
  id: context-bounded-execution-cases-planning-cap
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
# Context-Bounded Execution — Cap·Working closure 계약

## 목적 ^purpose

missing route, Discovery cap·size bound, Working overrun과 manifest 경계를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: context-runtime.working.reject-missing-route.v1
    owner_system: context-runtime
    contract_kind: validation-failure
    mode: read
    given:
      predicates: [route.selection_frozen, required_fact.has_no_resolution_route]
      fixtures: [context-runtime.fixture.order-release-missing-inventory-route]
    when:
      operation: context-runtime.compileWorkingContext
    then:
      error:
        code: context-closure-incomplete
      returns:
        working_context.status: blocked
        missing: includes_required_fact
      invariants: [no_execution_context_emitted]

  - id: context-runtime.discovery.stop-at-cap.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [discovery.used_tokens_at_cap, working.reserve_not_started]
      fixtures: [context-runtime.fixture.discovery-overflow]
    when:
      operation: context-runtime.planDiscovery
    then:
      returns:
        status: discovery-capped
        working_reserve_tokens: 100000
        decomposition: present_when_no_route_fits
      invariants: [no_silent_eviction, next_action_is_decompose_or_freeze]

  - id: context-runtime.discovery.size-bounded.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [discovery.candidate_routes_present, budget.object_and_relation_limits_present]
      fixtures: [context-runtime.fixture.discovery-size-overflow]
    when:
      operation: context-runtime.planDiscovery
    then:
      returns:
        selected_routes: within_object_and_relation_limits
        skipped_routes: explicit_size_limit_reason
        projected_size: present
      invariants: [no_silent_eviction, object_and_relation_caps_are_hard_limits]

  - id: context-runtime.working.reject-budget-overrun.v1
    owner_system: context-runtime
    contract_kind: validation-failure
    mode: read
    given:
      predicates: [route.selection_frozen, working_usage_exceeds_reserved_budget]
      fixtures: [context-runtime.fixture.working-budget-overflow]
    when:
      operation: context-runtime.compileWorkingContext
    then:
      error:
        code: context-closure-incomplete
      returns:
        working_context.status: blocked
        diagnostics: includes_working_budget_exhausted
      invariants: [no_execution_context_emitted, working_reserve_is_hard_limit]

  - id: context-runtime.manifest.deterministic.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [working_context.closed, snapshot.reference_available]
      fixtures: [context-runtime.fixture.completed-order-release]
    when:
      operation: context-runtime.createContextManifest
    then:
      returns:
        manifest.canonical_json: deterministic
        manifest.digest: present
        manifest.fact_refs: reference_only
```
