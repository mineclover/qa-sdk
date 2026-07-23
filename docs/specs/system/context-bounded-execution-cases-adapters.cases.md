---
def:
  id: context-bounded-execution-cases-adapters
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
# Context-Bounded Execution — Adapter·Observation 계약

## 목적 ^purpose

definition/federation/decision adapter와 metadata-only observation projection을 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: context-runtime.adapters.definition-discovery.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [definition-graph.port_available, task.anchor_available]
      fixtures: [context-runtime.fixture.definition-route-nodes]
    when:
      operation: context-runtime.definitionGraphDiscovery.discover
    then:
      returns:
        discovery.candidates: typed
        discovery.candidates.source_refs: present
      invariants: [adapter.does_not_own_definition_storage, candidates.retain_route_bounds]

  - id: context-runtime.adapters.federated-resolution.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [federation.query_port_available, resolution_route_selected]
      fixtures: [context-runtime.fixture.federated-inventory-fact]
    when:
      operation: context-runtime.federatedResolution.resolve
    then:
      returns:
        resolved_facts: typed
        resolved_facts.revisions: present
        resolved_facts.evidence_refs: present
      invariants: [adapter.does_not_own_federated_storage, undeclared_facts_filtered]

  - id: context-runtime.adapters.decision-hints.v1
    owner_system: context-runtime
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [decision-flow.hint_port_available, task.anchor_available]
      fixtures: [context-runtime.fixture.decision-hints]
    when:
      operation: context-runtime.decisionHints.getHints
    then:
      returns:
        hints: optional
        hints.provenance: decision-flow
      invariants: [hints.do_not_become_authoritative_facts]

  - id: context-runtime.observation.event-mapping.v1
    owner_system: context-runtime
    contract_kind: query-projection
    mode: read
    given:
      predicates: [context_runtime.result_available]
      fixtures: [context-runtime.fixture.closed-working-context]
    when:
      operation: context-runtime.mapContextObservation
    then:
      returns:
        observation.event: typed
        observation.address_context: event_metadata_only
```
