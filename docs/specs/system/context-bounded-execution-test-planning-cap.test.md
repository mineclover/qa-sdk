---
def:
  id: context-bounded-execution-test-planning-cap
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
# Context-Bounded Execution — Cap·Working closure 검증

## 목적 ^purpose

missing route, Discovery cap·size bound, Working overrun과 manifest의 test/implementation unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-missing-route
    contract: context-runtime.working.reject-missing-route.v1
    level: unit
    assertions:
      [
        then.error.code,
        then.returns.working_context.status,
        then.invariants.no_execution_context_emitted,
      ]
    test_file: packages/context-runtime/src/working-context.test.ts

  - id: TU-context-runtime-discovery-cap
    contract: context-runtime.discovery.stop-at-cap.v1
    level: unit
    assertions:
      [then.returns.status, then.returns.working_reserve_tokens, then.invariants.no_silent_eviction]
    test_file: packages/context-runtime/src/discovery.test.ts

  - id: TU-context-runtime-discovery-size-cap
    contract: context-runtime.discovery.size-bounded.v1
    level: unit
    assertions:
      [
        then.returns.selected_routes,
        then.returns.skipped_routes,
        then.returns.projected_size,
        then.invariants.object_and_relation_caps_are_hard_limits,
      ]
    test_file: packages/context-runtime/src/discovery.test.ts

  - id: TU-context-runtime-working-budget-overrun
    contract: context-runtime.working.reject-budget-overrun.v1
    level: unit
    assertions:
      [
        then.returns.working_context.status,
        then.returns.diagnostics,
        then.invariants.working_reserve_is_hard_limit,
      ]
    test_file: packages/context-runtime/src/working-context.test.ts

  - id: TU-context-runtime-manifest-deterministic
    contract: context-runtime.manifest.deterministic.v1
    level: unit
    assertions:
      [
        then.returns.manifest.canonical_json,
        then.returns.manifest.digest,
        then.invariants.manifest.excludes_fact_values,
      ]
    test_file: packages/context-runtime/src/manifest.test.ts
implementation_units:
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

  - id: IU-context-runtime-discovery-size-cap-guard
    contract: context-runtime.discovery.size-bounded.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/discovery.ts:planDiscovery
    effects: [discovery.object_cap, discovery.relation_cap, discovery.size_diagnostics]

  - id: IU-context-runtime-working-budget-guard
    contract: context-runtime.working.reject-budget-overrun.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/working-context.ts:compileWorkingContext
    effects: [working.budget_blocked]

  - id: IU-context-runtime-context-manifest
    contract: context-runtime.manifest.deterministic.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/handoff.ts:createContextManifest
    effects: [context.manifest, manifest.digest]
```
