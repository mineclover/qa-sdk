---
def:
  id: context-bounded-execution-test-usage
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
sources:
  - packages/context-runtime/src/usage.test.ts
  - packages/context-runtime/src/adapters.test.ts
  - packages/context-runtime/src/discovery.test.ts
  - packages/context-runtime/src/usage.ts:createContextUsageLedger
  - packages/context-runtime/src/adapters.ts:mapContextObservation
  - packages/context-runtime/src/discovery.ts:planDiscovery
  - packages/context-runtime/src/usage.ts:createProviderUsageEvent
---
# Context-Bounded Execution — Usage 검증

## 목적 ^purpose

phase-separated usage ledger, malformed input, measured token counter와 provider usage의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-usage-ledger
    contract: context-runtime.usage.ledger.v1
    level: unit
    assertions:
      [
        then.returns.usage.discovery_tokens,
        then.returns.usage.working_tokens,
        then.returns.usage.total_tokens,
        then.invariants.usage.phases_do_not_merge,
      ]
    test_file: packages/context-runtime/src/usage.test.ts

  - id: TU-context-runtime-usage-malformed-input
    contract: context-runtime.usage.reject-malformed-input.v1
    level: unit
    assertions:
      [then.error.code, then.error.issues, then.invariants.usage.phase_and_measurement_validated]
    test_file: packages/context-runtime/src/adapters.test.ts

  - id: TU-context-runtime-provider-usage-adapter
    contract: context-runtime.usage.provider-adapter.v1
    level: unit
    assertions:
      [
        then.returns.usage_event.measurement,
        then.returns.usage_event.tokens,
        then.returns.usage_event.metrics,
        then.invariants.provider_total_not_double_counted,
      ]
    test_file: packages/context-runtime/src/usage.test.ts

  - id: TU-context-runtime-discovery-token-counter
    contract: context-runtime.usage.discovery-token-counter.v1
    level: unit
    assertions:
      [
        then.returns.discovery.projections.cost,
        then.returns.discovery.projections.cost_measurement,
        then.returns.discovery.skipped_routes.cost_measurement,
        then.invariants.counter_applied_before_budget_selection,
        then.invariants.phase_context_is_forwarded,
        then.invariants.legacy_route_estimate_not_counted,
      ]
    test_file: packages/context-runtime/src/discovery.test.ts
implementation_units:
  - id: IU-context-runtime-usage-ledger
    contract: context-runtime.usage.ledger.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/usage.ts:createContextUsageLedger
    effects: [context.usage_snapshot]

  - id: IU-context-runtime-usage-input-guard
    contract: context-runtime.usage.reject-malformed-input.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/adapters.ts:mapContextObservation
    effects: [context.usage_input_rejected]

  - id: IU-context-runtime-discovery-token-counter
    contract: context-runtime.usage.discovery-token-counter.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/discovery.ts:planDiscovery
    effects:
      [
        discovery.measured_candidate_cost,
        discovery.measured_skip_cost,
        discovery.token_counter_phase_context,
      ]

  - id: IU-context-runtime-provider-usage-adapter
    contract: context-runtime.usage.provider-adapter.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/usage.ts:createProviderUsageEvent
    effects: [context.measured_provider_usage, context.usage_metrics]
```
