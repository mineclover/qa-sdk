---
def:
  id: context-bounded-execution-test-provider-usage
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
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:createProviderUsageAdapter
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:createProviderTokenCounter
---
# Context-Bounded Execution — Provider usage 검증

## 목적 ^purpose

provider response usage와 provider/model token counter의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-docs-control-plane-provider-usage-adapter
    contract: docs-control-plane.definition-context.provider-usage-adapter.v1
    level: unit
    assertions:
      [
        then.returns.usage_event.measurement,
        then.returns.usage_event.tokens,
        then.returns.usage_event.provider,
        then.invariants.anthropic_cache_input_is_included,
        then.invariants.nested_transport_envelope_is_supported,
        then.invariants.stream_usage_is_combined,
        then.invariants.stream_file_is_accepted,
      ]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts

  - id: TU-docs-control-plane-provider-token-counter
    contract: docs-control-plane.definition-context.provider-token-counter.v1
    level: unit
    assertions:
      [
        then.returns.token_counter.measurement,
        then.returns.token_counter.provider,
        then.returns.token_counter.model,
        then.invariants.invalid_tokenizer_count_rejected,
      ]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts
implementation_units:
  - id: IU-docs-control-plane-provider-usage-adapter
    contract: docs-control-plane.definition-context.provider-usage-adapter.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:createProviderUsageAdapter
    effects: [definition.provider_usage_normalized, definition.provider_exact_total]

  - id: IU-docs-control-plane-provider-token-counter
    contract: docs-control-plane.definition-context.provider-token-counter.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:createProviderTokenCounter
    effects: [definition.provider_model_token_counter]
```
