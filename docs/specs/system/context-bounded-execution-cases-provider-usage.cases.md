---
def:
  id: context-bounded-execution-cases-provider-usage
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
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts
  - packages/context-runtime/src/usage.ts
---
# Context-Bounded Execution — Provider usage 계약

## 목적 ^purpose

provider response usage와 provider/model token counter의 측정 identity를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.definition-context.provider-usage-adapter.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [provider_response_envelope_available, provider_phase_declared]
      fixtures:
        [
          docs-control-plane.fixture.openai-response-usage,
          docs-control-plane.fixture.anthropic-message-usage,
        ]
    when:
      operation: docs-control-plane.createProviderUsageAdapter
    then:
      returns:
        usage_event.measurement: measured
        usage_event.tokens: provider_exact_total
        usage_event.provider: preserved
      invariants:
        [
          anthropic_cache_input_is_included,
          nested_transport_envelope_is_supported,
          stream_usage_is_combined,
          stream_file_is_accepted,
          runtime_has_no_provider_sdk_dependency,
        ]

  - id: docs-control-plane.definition-context.provider-token-counter.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [provider_model_tokenizer_available]
      fixtures: [docs-control-plane.fixture.provider-tokenizer]
    when:
      operation: docs-control-plane.createProviderTokenCounter
    then:
      returns:
        token_counter.measurement: measured
        token_counter.provider: preserved
        token_counter.model: preserved
      invariants: [invalid_tokenizer_count_rejected, runtime_has_no_provider_sdk_dependency]
```
