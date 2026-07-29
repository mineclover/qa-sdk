---
def:
  id: context-bounded-execution-cases-provider-tokenizer
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
    - target: provider-tokenizer-openai-gpt-4o
      type: traces_to
sources:
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts
---
# Context-Bounded Execution — 외부 tokenizer 계약

## 목적 ^purpose

외부 tokenizer module과 registry 선택, 잘못된 선택·export의 fail-closed 동작을 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.definition-context.provider-tokenizer-module.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [provider_tokenizer_module_available, provider_model_selection_matches]
      fixtures: [docs-control-plane.fixture.provider-tokenizer-module]
    when:
      operation: docs-control-plane.loadProviderTokenCounter
    then:
      returns:
        token_counter.measurement: measured
        token_counter.provider: declared
        token_counter.model: declared
        token_counter.tokenizer_revision: preserved
      invariants:
        [
          module_export_is_validated,
          runtime_receives_selected_counter,
          usage_events_preserve_tokenizer_identity,
          runtime_has_no_provider_sdk_dependency,
        ]

  - id: docs-control-plane.definition-context.provider-tokenizer-module.invalid-selection.v1
    owner_system: docs-control-plane
    contract_kind: validation-failure
    mode: read
    given:
      predicates: [provider_tokenizer_module_available, provider_model_selection_mismatches]
      fixtures: [docs-control-plane.fixture.provider-tokenizer-module]
    when:
      operation: docs-control-plane.loadProviderTokenCounter
    then:
      error:
        code: provider-tokenizer-selection-mismatch
      invariants: [bounded_execution_is_not_started]

  - id: docs-control-plane.definition-context.provider-tokenizer-module.invalid-export.v1
    owner_system: docs-control-plane
    contract_kind: validation-failure
    mode: read
    given:
      predicates: [provider_tokenizer_module_export_invalid]
      fixtures: [docs-control-plane.fixture.invalid-provider-tokenizer-module]
    when:
      operation: docs-control-plane.loadProviderTokenCounter
    then:
      error:
        code: provider-tokenizer-module-invalid
      invariants: [bounded_execution_is_not_started]

  - id: docs-control-plane.definition-context.provider-tokenizer-registry.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [provider_tokenizer_registry_available, provider_model_selection_matches]
      fixtures: [docs-control-plane.fixture.provider-tokenizer-registry]
    when:
      operation: docs-control-plane.loadProviderTokenCounterFromRegistry
    then:
      returns:
        token_counter.measurement: measured
        token_counter.provider: selected_registry_entry
        token_counter.model: selected_registry_entry
      invariants:
        [
          registry_entry_is_selected_before_module_load,
          module_identity_matches_registry,
          runtime_has_no_provider_sdk_dependency,
        ]

  - id: docs-control-plane.definition-context.provider-tokenizer-registry.invalid-selection.v1
    owner_system: docs-control-plane
    contract_kind: validation-failure
    mode: read
    given:
      predicates:
        [provider_tokenizer_registry_available, provider_model_selection_ambiguous_or_missing]
      fixtures: [docs-control-plane.fixture.provider-tokenizer-registry]
    when:
      operation: docs-control-plane.loadProviderTokenCounterFromRegistry
    then:
      error:
        code: provider-tokenizer-selection-mismatch
      invariants: [bounded_execution_is_not_started]

  - id: docs-control-plane.definition-context.provider-tokenizer-openai.gpt-4o.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [openai_gpt4o_tokenizer_package_available, canonical_context_value_present]
      fixtures: [docs-control-plane.fixture.openai-gpt-4o-tokenizer]
    when:
      operation: docs-control-plane.loadProviderTokenCounterFromRegistry
    then:
      returns:
        token_counter.measurement: measured
        token_counter.provider: openai
        token_counter.model: gpt-4o
        token_counter.tokenizer_revision: declared
      invariants:
        [canonical_value_serialization_is_deterministic, model_specific_encoding_is_used, runtime_has_no_provider_sdk_dependency]
```
