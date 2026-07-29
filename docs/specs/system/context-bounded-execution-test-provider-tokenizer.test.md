---
def:
  id: context-bounded-execution-test-provider-tokenizer
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
  - packages/provider-tokenizer-openai/src/index.test.ts
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:loadProviderTokenCounter
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:unwrapProviderTokenCounterModule
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:loadProviderTokenCounterFromRegistry
  - packages/provider-tokenizer-openai/src/index.ts:providerTokenCounter
---
# Context-Bounded Execution — 외부 tokenizer 검증

## 목적 ^purpose

외부 tokenizer module과 registry 선택 및 fail-closed guard의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-docs-control-plane-provider-tokenizer-module
    contract: docs-control-plane.definition-context.provider-tokenizer-module.v1
    level: unit
    assertions:
      [
        then.returns.token_counter.measurement,
        then.returns.token_counter.provider,
        then.returns.token_counter.model,
        then.returns.token_counter.tokenizer_revision,
        then.invariants.module_export_is_validated,
        then.invariants.runtime_receives_selected_counter,
        then.invariants.usage_events_preserve_tokenizer_identity,
      ]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts

  - id: TU-docs-control-plane-provider-tokenizer-module-invalid-selection
    contract: docs-control-plane.definition-context.provider-tokenizer-module.invalid-selection.v1
    level: unit
    assertions: [then.error.code, then.invariants.bounded_execution_is_not_started]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts

  - id: TU-docs-control-plane-provider-tokenizer-module-invalid-export
    contract: docs-control-plane.definition-context.provider-tokenizer-module.invalid-export.v1
    level: unit
    assertions: [then.error.code, then.invariants.bounded_execution_is_not_started]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts

  - id: TU-docs-control-plane-provider-tokenizer-registry
    contract: docs-control-plane.definition-context.provider-tokenizer-registry.v1
    level: unit
    assertions:
      [
        then.returns.token_counter.measurement,
        then.returns.token_counter.provider,
        then.returns.token_counter.model,
        then.invariants.registry_entry_is_selected_before_module_load,
        then.invariants.module_identity_matches_registry,
      ]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts

  - id: TU-docs-control-plane-provider-tokenizer-registry-invalid-selection
    contract: docs-control-plane.definition-context.provider-tokenizer-registry.invalid-selection.v1
    level: unit
    assertions: [then.error.code, then.invariants.bounded_execution_is_not_started]
    test_file: packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts

  - id: TU-docs-control-plane-provider-tokenizer-openai-gpt-4o
    contract: docs-control-plane.definition-context.provider-tokenizer-openai.gpt-4o.v1
    level: unit
    assertions:
      [then.returns.token_counter.provider, then.returns.token_counter.model, then.returns.token_counter.tokenizer_revision, then.invariants.canonical_value_serialization_is_deterministic]
    test_file: packages/provider-tokenizer-openai/src/index.test.ts
implementation_units:
  - id: IU-docs-control-plane-provider-tokenizer-module
    contract: docs-control-plane.definition-context.provider-tokenizer-module.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:loadProviderTokenCounter
    effects: [definition.provider_model_token_counter, definition.tokenizer_usage_identity]

  - id: IU-docs-control-plane-provider-tokenizer-module-selection-guard
    contract: docs-control-plane.definition-context.provider-tokenizer-module.invalid-selection.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:loadProviderTokenCounter
    effects: [definition.provider_tokenizer_selection_rejected]

  - id: IU-docs-control-plane-provider-tokenizer-module-export-guard
    contract: docs-control-plane.definition-context.provider-tokenizer-module.invalid-export.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:unwrapProviderTokenCounterModule
    effects: [definition.provider_tokenizer_module_rejected]

  - id: IU-docs-control-plane-provider-tokenizer-registry
    contract: docs-control-plane.definition-context.provider-tokenizer-registry.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:loadProviderTokenCounterFromRegistry
    effects: [definition.provider_tokenizer_registry_selected]

  - id: IU-docs-control-plane-provider-tokenizer-registry-selection-guard
    contract: docs-control-plane.definition-context.provider-tokenizer-registry.invalid-selection.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/provider-usage-adapters.ts:loadProviderTokenCounterFromRegistry
    effects: [definition.provider_tokenizer_registry_selection_rejected]

  - id: IU-docs-control-plane-provider-tokenizer-openai-gpt-4o
    contract: docs-control-plane.definition-context.provider-tokenizer-openai.gpt-4o.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/provider-tokenizer-openai/src/index.ts:providerTokenCounter
    effects: [definition.openai_gpt4o_token_count, definition.tokenizer_usage_identity]
```
