---
def:
  id: context-bounded-execution-cases-definition-working
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
  - packages/cli/src/lib/context-runtime/definition-document-context.ts
  - packages/context-runtime/src/working-context.ts
  - packages/cli/src/commands/def.context.test.ts
---
# Context-Bounded Execution — Definition working 계약

## 목적 ^purpose

최소 Working Fact, observation sink와 phase-separated usage accounting을 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.definition-context.minimum-working-facts.v1
    owner_system: docs-control-plane
    contract_kind: validation-failure
    mode: read
    given:
      predicates:
        [
          definition.document_exists,
          required_working_facts_declared,
          required_route_not_selected_or_unresolved,
        ]
      fixtures: [definition-context.fixture.partial-working-context]
    when:
      operation: docs-control-plane.buildBoundedDefinitionContext
    then:
      error:
        code: context-closure-incomplete
      returns:
        working_context.status: blocked
        manifest: absent
      invariants: [minimum_working_facts_are_not_optional, no_partial_context_claimed_as_closed]

  - id: docs-control-plane.definition-context.observation-sink.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [bounded_context_result_available, observation_sink_injected]
      fixtures: [definition-context.fixture.counting-source]
    when:
      operation: docs-control-plane.buildBoundedDefinitionContext
    then:
      returns:
        observation: delivered_to_sink
      invariants: [observation_sink_receives_metadata_only, sink_is_optional]

  - id: docs-control-plane.definition-context.usage-accounting.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [definition.document_exists, token_counter_injected]
      fixtures: [definition-context.fixture.counting-source]
    when:
      operation: docs-control-plane.buildBoundedDefinitionContext
    then:
      returns:
        usage: phase_separated
        observation.usage: present
        observation_event: event_record_compatible
      invariants:
        [
          discovery_usage_drives_cap,
          working_usage_drives_closure,
          discovery_and_working_share_counter,
          phase_context_is_forwarded,
          usage_excludes_fact_values,
          initial_usage_summary_consistent,
        ]

  - id: docs-control-plane.definition-context.usage-input.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [usage_summary_or_provider_response_available, usage_summary_events_valid]
      fixtures: [definition-context.fixture.measured-usage]
    when:
      operation: docs-control-plane.def.context.bounded.initialUsage
    then:
      returns:
        usage: measured_snapshot_applied
        discovery.status: discovery-capped_or_planned
      invariants:
        [usage_summary_is_validated_by_runtime_ledger, initial_usage_is_not_mixed_with_used_tokens]
```
