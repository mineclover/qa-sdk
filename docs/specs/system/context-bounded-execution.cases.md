---
def:
  id: context-bounded-execution-cases
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [scenario, testing, architecture, context]
  links:
    - target: context-bounded-execution
      type: refines
    - target: context-bounded-execution-todo
      type: traces_to
---

# Context-Bounded Execution — 행동 계약

## 목적 ^purpose

Discovery Context와 Working Context가 예산·경로·정보 신뢰도·handoff에서 분리되는 동작을 결정론적 계약으로 고정한다.

## BDD 계약 ^overview

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
      predicates: [task.intent_available, discovery.candidate_routes_present, budget.working_reserve_is_100k]
      fixtures: [context-runtime.fixture.order-release-candidates]
    when:
      operation: context-runtime.planDiscovery
    then:
      returns:
        discovery.plan: deterministic
        candidate.projections: cost_authority_freshness_size
      invariants: [selected_routes_have_bounds, discovery.does_not_borrow_working_reserve, same_input_same_plan]

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
      predicates: [route.selection_frozen, required_facts.have_resolution_routes, facts.authority_and_freshness_valid]
      fixtures: [context-runtime.fixture.order-release-authoritative-facts]
    when:
      operation: context-runtime.compileWorkingContext
    then:
      returns:
        working_context.status: closed
        working_context.facts: authoritative_only
        manifest: present
      invariants: [working_context.contains_revisions, working_context.contains_evidence_refs]

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
      invariants: [no_silent_eviction, next_action_is_decompose_or_freeze]

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
      invariants: [handoff.excludes_conversation_transcript, handoff.preserves_revisions_and_manifest_digest]

```

## 시나리오 해석 ^context

Discovery에서 찾은 `order.inventory`는 재고 상태가 아니다. Working Compiler가 ResolutionRoute를 통해 authority와 revision을 확인한 뒤에만 실행 Fact가 된다. Discovery cap에 도달한 경우에도 Working reserve를 줄여 계속하지 않고, 현재 탐색 결과를 freeze하거나 Task를 분해한다.
