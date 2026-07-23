---
def:
  id: context-bounded-execution-cases-usage
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
# Context-Bounded Execution — Usage 계약

## 목적 ^purpose

phase-separated usage ledger, malformed input, measured token counter와 provider usage를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: context-runtime.usage.ledger.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [token_counter_available, discovery_or_working_usage_present]
      fixtures: [context-runtime.fixture.measured-usage]
    when:
      operation: context-runtime.createContextUsageLedger
    then:
      returns:
        usage.discovery_tokens: present
        usage.working_tokens: present
        usage.total_tokens: present
        usage.measurement_mode: estimated_or_measured
      invariants: [usage.phases_do_not_merge, usage.never_negative, same_events_same_snapshot]

  - id: context-runtime.usage.reject-malformed-input.v1
    owner_system: context-runtime
    contract_kind: validation-failure
    mode: read
    given:
      predicates: [observation.usage_present, usage.event_shape_invalid]
      fixtures: [context-runtime.fixture.malformed-usage]
    when:
      operation: context-runtime.mapContextObservation
    then:
      error:
        code: invalid-context-adapter
      invariants: [usage.phase_and_measurement_validated, usage.references_non_empty]

  - id: context-runtime.usage.discovery-token-counter.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [discovery.candidate_routes_present, provider_model_token_counter_available]
      fixtures: [context-runtime.fixture.measured-discovery-candidates]
    when:
      operation: context-runtime.planDiscovery
    then:
      returns:
        discovery.projections.cost: provider_counted
        discovery.projections.cost_measurement: measured
        discovery.skipped_routes.cost_measurement: measured
      invariants:
        [
          counter_applied_before_budget_selection,
          phase_context_is_forwarded,
          legacy_route_estimate_not_counted,
          invalid_counter_output_rejected,
        ]

  - id: context-runtime.usage.provider-adapter.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates:
        [provider_usage_snapshot_available, provider_phase_declared, provider_total_is_consistent]
      fixtures: [context-runtime.fixture.measured-provider-usage]
    when:
      operation: context-runtime.createProviderUsageEvent
    then:
      returns:
        usage_event.measurement: measured
        usage_event.tokens: provider_reported_total
        usage_event.metrics: bytes_and_latency_optional
      invariants:
        [
          provider_total_not_double_counted,
          provider_identity_preserved,
          runtime_has_no_provider_sdk_dependency,
        ]
```
