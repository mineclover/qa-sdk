---
def:
  id: context-bounded-execution-cases-stop-rules
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
    - target: context-stop-rules-todo
      type: traces_to
---
# Context-Bounded Execution — Stop Rules 계약

## 목적 ^purpose

설정된 Route를 따라 특정 주제의 Context를 수집할 때, 예산·구조적 한계뿐 아니라 declared obligation 충족과 no-progress를 기준으로 탐색을 결정론적으로 중단하는 구현 계약을 정의한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: context-runtime.discovery.stop-on-coverage.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates:
        [discovery.candidate_routes_present, stop_policy.required_obligations_declared]
      fixtures: [context-runtime.fixture.topic-coverage-satisfied]
    when:
      operation: context-runtime.evaluateStopDecision
    then:
      returns:
        stop.reason: coverage-satisfied
        stop.action: freeze
        stop.unresolved_obligations: empty
      invariants:
        [no_additional_route_expansion, same_input_same_stop_decision]

  - id: context-runtime.discovery.stop-on-no-progress.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates:
        [stop_policy.no_progress_limit_declared, consecutive_expansions_add_no_new_evidence]
      fixtures: [context-runtime.fixture.topic-no-progress]
    when:
      operation: context-runtime.evaluateStopDecision
    then:
      returns:
        stop.reason: no-progress
        stop.action: block_or_decompose
        stop.unresolved_obligations: non_empty
        stop.progress: present
      invariants: [no_unbounded_expansion, unresolved_obligations_are_explicit]

  - id: context-runtime.discovery.evaluate-source-exhausted.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [discovery.candidates_exhausted, stop_policy.unresolved_obligations_present]
      fixtures: [context-runtime.fixture.topic-source-exhausted]
    when:
      operation: context-runtime.evaluateStopDecision
    then:
      returns:
        stop.reason: source-exhausted
        stop.action: block
        stop.unresolved_obligations: non_empty
      invariants: [unresolved_obligations_are_explicit]

  - id: context-runtime.working.stop-on-source-exhausted.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [discovery.candidates_exhausted, stop_policy.unresolved_obligations_present]
      fixtures: [context-runtime.fixture.topic-source-exhausted]
    when:
      operation: context-runtime.compileWorkingContext
    then:
      returns:
        stop.reason: source-exhausted
        working_context.status: blocked
      invariants: [no_execution_context_emitted, no_manifest_created]

  - id: context-runtime.stop.hard-cap-precedence.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates:
        [stop_policy.coverage_declared, discovery.budget_or_route_bound_reached]
      fixtures: [context-runtime.fixture.topic-coverage-but-budget-capped]
    when:
      operation: context-runtime.evaluateStopDecision
    then:
      returns:
        stop.reason: budget_or_route_bound_reason
        stop.action: decompose_or_block
      invariants: [hard_cap_cannot_be_overridden_by_coverage]
```
