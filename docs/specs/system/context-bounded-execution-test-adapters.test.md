---
def:
  id: context-bounded-execution-test-adapters
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
# Context-Bounded Execution — Adapter·Observation 검증

## 목적 ^purpose

definition/federation/decision adapter와 metadata-only observation projection의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-definition-discovery-adapter
    contract: context-runtime.adapters.definition-discovery.v1
    level: unit
    assertions:
      [
        then.returns.discovery.candidates,
        then.returns.discovery.candidates.source_refs,
        then.invariants.candidates.retain_route_bounds,
      ]
    test_file: packages/context-runtime/src/adapters.test.ts

  - id: TU-context-runtime-federated-resolution-adapter
    contract: context-runtime.adapters.federated-resolution.v1
    level: unit
    assertions:
      [
        then.returns.resolved_facts,
        then.returns.resolved_facts.revisions,
        then.invariants.undeclared_facts_filtered,
      ]
    test_file: packages/context-runtime/src/adapters.test.ts

  - id: TU-context-runtime-decision-hints-adapter
    contract: context-runtime.adapters.decision-hints.v1
    level: unit
    assertions:
      [
        then.returns.hints,
        then.returns.hints.provenance,
        then.invariants.hints.do_not_become_authoritative_facts,
      ]
    test_file: packages/context-runtime/src/adapters.test.ts

  - id: TU-context-runtime-observation-event-mapping
    contract: context-runtime.observation.event-mapping.v1
    level: unit
    assertions:
      [
        then.returns.observation.event,
        then.returns.observation.address_context,
        then.invariants.observation.excludes_fact_values,
      ]
    test_file: packages/context-runtime/src/adapters.test.ts
implementation_units:
  - id: IU-context-runtime-definition-discovery-adapter
    contract: context-runtime.adapters.definition-discovery.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/adapters.ts:createDefinitionGraphDiscoveryAdapter
    effects: [discovery.candidate_projection]

  - id: IU-context-runtime-federated-resolution-adapter
    contract: context-runtime.adapters.federated-resolution.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/adapters.ts:createFederatedResolutionAdapter
    effects: [resolution.fact_projection]

  - id: IU-context-runtime-decision-hints-adapter
    contract: context-runtime.adapters.decision-hints.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/adapters.ts:createDecisionHintAdapter
    effects: [decision.hint_projection]

  - id: IU-context-runtime-observation-event-mapping
    contract: context-runtime.observation.event-mapping.v1
    unit_kind: projection
    owned_by: context-runtime
    source_target: packages/context-runtime/src/adapters.ts:mapContextObservation
    effects: [context.observation_event]
```
