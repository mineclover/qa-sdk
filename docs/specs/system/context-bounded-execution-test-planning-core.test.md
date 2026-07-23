---
def:
  id: context-bounded-execution-test-planning-core
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
# Context-Bounded Execution — 예산·Route 검증

## 목적 ^purpose

예산 격리, route freeze와 authoritative fact 해소의 test/implementation unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-budget-reserve-isolation
    contract: context-runtime.budget.reserve-isolation.v1
    level: unit
    assertions:
      [
        then.returns.discovery.max_tokens,
        then.returns.working.reserve_tokens,
        then.invariants.budget.no_borrow_from_working,
      ]
    test_file: packages/context-runtime/src/budget.test.ts

  - id: TU-context-runtime-route-freeze
    contract: context-runtime.discovery-to-working.route-freeze.v1
    level: unit
    assertions:
      [
        then.returns.selected_routes,
        then.returns.working_context,
        then.invariants.discovery.summary_not_fact,
      ]
    test_file: packages/context-runtime/src/routes.test.ts

  - id: TU-context-runtime-discovery-plan
    contract: context-runtime.discovery.plan-routes.v1
    level: unit
    assertions:
      [
        then.returns.discovery.plan,
        then.returns.candidate.projections,
        then.invariants.same_input_same_plan,
      ]
    test_file: packages/context-runtime/src/discovery.test.ts

  - id: TU-context-runtime-authoritative-facts
    contract: context-runtime.working.resolve-authoritative-facts.v1
    level: integration
    assertions:
      [
        then.returns.working_context.status,
        then.returns.working_context.facts,
        then.invariants.working_context.contains_revisions,
      ]
    test_file: packages/context-runtime/src/working-context.test.ts
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
```
