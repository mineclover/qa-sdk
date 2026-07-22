---
def:
  id: context-bounded-execution-test
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [testing, architecture, context]
  links:
    - target: context-bounded-execution
      type: refines
    - target: context-bounded-execution-cases
      type: depends_on
    - target: context-bounded-execution-todo
      type: traces_to
    - target: context-runtime
      type: traces_to
---

# Context-Bounded Execution — 검증 매핑

## 목적 ^purpose

Discovery/Working Context 계약을 구현할 때 사용할 test unit과 implementation unit을 연결한다. 구현된 unit은 실제 source target을 가리키고, 이후 Phase의 unit은 예정 경계로 남긴다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-budget-reserve-isolation
    contract: context-runtime.budget.reserve-isolation.v1
    level: unit
    assertions: [then.returns.discovery.max_tokens, then.returns.working.reserve_tokens, then.invariants.budget.no_borrow_from_working]
    test_file: packages/context-runtime/src/budget.test.ts

  - id: TU-context-runtime-route-freeze
    contract: context-runtime.discovery-to-working.route-freeze.v1
    level: unit
    assertions: [then.returns.selected_routes, then.returns.working_context, then.invariants.discovery.summary_not_fact]
    test_file: packages/context-runtime/src/routes.test.ts

  - id: TU-context-runtime-discovery-plan
    contract: context-runtime.discovery.plan-routes.v1
    level: unit
    assertions: [then.returns.discovery.plan, then.returns.candidate.projections, then.invariants.same_input_same_plan]
    test_file: packages/context-runtime/src/discovery.test.ts

  - id: TU-context-runtime-authoritative-facts
    contract: context-runtime.working.resolve-authoritative-facts.v1
    level: integration
    assertions: [then.returns.working_context.status, then.returns.working_context.facts, then.invariants.working_context.contains_revisions]
    test_file: packages/context-runtime/src/working-context.test.ts

  - id: TU-context-runtime-missing-route
    contract: context-runtime.working.reject-missing-route.v1
    level: unit
    assertions: [then.error.code, then.returns.working_context.status, then.invariants.no_execution_context_emitted]
    test_file: packages/context-runtime/src/working-context.test.ts

  - id: TU-context-runtime-discovery-cap
    contract: context-runtime.discovery.stop-at-cap.v1
    level: unit
    assertions: [then.returns.status, then.returns.working_reserve_tokens, then.invariants.no_silent_eviction]
    test_file: packages/context-runtime/src/discovery.test.ts

  - id: TU-context-runtime-reference-only-handoff
    contract: context-runtime.handoff.reference-only.v1
    level: unit
    assertions: [then.returns.handoff, then.returns.evidence_refs, then.invariants.handoff.excludes_conversation_transcript]
    test_file: packages/context-runtime/src/handoff.test.ts

implementation_units:
  - id: IU-context-runtime-budget-profile
    contract: context-runtime.budget.reserve-isolation.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/budget.ts
    effects: [budget.profile_validation]

  - id: IU-context-runtime-route-selection-freeze
    contract: context-runtime.discovery-to-working.route-freeze.v1
    unit_kind: operation
    owned_by: context-runtime
    source_target: packages/context-runtime/src/routes.ts:freezeRouteSelection
    effects: [route.selection.freeze]

  - id: IU-context-runtime-discovery-planner
    contract: context-runtime.discovery.plan-routes.v1
    unit_kind: operation
    owned_by: context-runtime
    source_target: packages/context-runtime/src/discovery.ts:planDiscovery
    effects: [discovery.plan, route.projection]

  - id: IU-context-runtime-working-compiler
    contract: context-runtime.working.resolve-authoritative-facts.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/working-context.ts:compileWorkingContext
    effects: [working.context.envelope, context.manifest]

  - id: IU-context-runtime-closure-validator
    contract: context-runtime.working.reject-missing-route.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/working-context.ts:assertWorkingContext
    effects: [context.closure.blocked]

  - id: IU-context-runtime-discovery-cap-guard
    contract: context-runtime.discovery.stop-at-cap.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/discovery.ts:planDiscovery
    effects: [discovery.capped, work.reserve.preserved]

  - id: IU-context-runtime-task-handoff
    contract: context-runtime.handoff.reference-only.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/task-handoff.ts
    effects: [typed.task.handoff]
```

## 구현 전 검증 항목 ^validation

- 각 unit이 하나의 contract id만 소유하는가
- `Working Context` 테스트가 Discovery summary를 Fact로 인정하지 않는가
- cap 테스트가 Working reserve를 감소시키지 않는가
- missing route와 stale authority가 실행 Context를 만들지 않는가
- handoff 테스트가 transcript 원문을 전달하지 않는가
