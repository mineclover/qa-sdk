---
def:
  id: context-bounded-execution-test-definition-working
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
  - packages/cli/src/lib/context-runtime/definition-document-context.test.ts
  - packages/cli/src/commands/def.context.test.ts
  - packages/cli/src/lib/context-runtime/definition-document-context.ts:createRequiredFacts
  - packages/cli/src/lib/context-runtime/definition-document-context.ts:buildBoundedDefinitionContext
  - packages/cli/src/commands/def.ts:readInitialUsageSummary
---
# Context-Bounded Execution — Definition working 검증

## 목적 ^purpose

최소 Working Fact, observation sink와 phase-separated usage accounting의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-docs-control-plane-shared-token-counter
    contract: docs-control-plane.definition-context.usage-accounting.v1
    level: unit
    assertions:
      [
        then.returns.usage,
        then.invariants.discovery_and_working_share_counter,
        then.invariants.phase_context_is_forwarded,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-minimum-working-facts
    contract: docs-control-plane.definition-context.minimum-working-facts.v1
    level: integration
    assertions:
      [
        then.returns.working_context.status,
        then.returns.manifest,
        then.invariants.minimum_working_facts_are_not_optional,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-observation-sink
    contract: docs-control-plane.definition-context.observation-sink.v1
    level: integration
    assertions:
      [
        then.returns.observation,
        then.invariants.observation_sink_receives_metadata_only,
        then.invariants.sink_is_optional,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-usage-accounting
    contract: docs-control-plane.definition-context.usage-accounting.v1
    level: integration
    assertions:
      [
        then.returns.usage,
        then.returns.observation.usage,
        then.returns.observation_event,
        then.invariants.discovery_usage_drives_cap,
        then.invariants.working_usage_drives_closure,
        then.invariants.initial_usage_summary_consistent,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-usage-input
    contract: docs-control-plane.definition-context.usage-input.v1
    level: integration
    assertions:
      [
        then.returns.usage,
        then.returns.discovery.status,
        then.invariants.usage_summary_is_validated_by_runtime_ledger,
      ]
    test_file: packages/cli/src/commands/def.context.test.ts
implementation_units:
  - id: IU-docs-control-plane-bounded-context-minimum-working-facts
    contract: docs-control-plane.definition-context.minimum-working-facts.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:createRequiredFacts
    effects: [definition.minimum_working_facts, definition.partial_context_blocked]

  - id: IU-docs-control-plane-bounded-context-observation-sink
    contract: docs-control-plane.definition-context.observation-sink.v1
    unit_kind: emitter
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:buildBoundedDefinitionContext
    effects: [definition.context_observation_sink]

  - id: IU-docs-control-plane-bounded-context-usage-accounting
    contract: docs-control-plane.definition-context.usage-accounting.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:buildBoundedDefinitionContext
    effects:
      [
        definition.context_usage,
        definition.usage_observation,
        definition.observation_event,
        definition.token_counter_phase_context,
      ]

  - id: IU-docs-control-plane-bounded-context-usage-input
    contract: docs-control-plane.definition-context.usage-input.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/def.ts:readInitialUsageSummary
    effects: [definition.initial_usage_input]
```
