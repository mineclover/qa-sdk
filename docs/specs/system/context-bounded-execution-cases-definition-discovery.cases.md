---
def:
  id: context-bounded-execution-cases-definition-discovery
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
  - packages/cli/src/commands/def.context.test.ts
---
# Context-Bounded Execution — Definition discovery 계약

## 목적 ^purpose

lazy resolution, graph discovery와 local/server source transport 경계를 검증한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.definition-context.lazy-resolution.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [definition.document_exists, discovery.plan_available, source_resolution_is_lazy]
      fixtures: [definition-context.fixture.counting-source]
    when:
      operation: docs-control-plane.def.context.bounded
    then:
      returns:
        selected_routes: frozen_before_optional_source_reads
        working_context: typed
      invariants:
        [blocked_discovery_does_not_read_body_or_boundary, only_selected_routes_are_resolved]

  - id: docs-control-plane.definition-context.graph-discovery.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates:
        [
          definition.document_exists,
          definition.links_or_children_present,
          context.runtime_budget_available,
        ]
      fixtures: [definition-context.fixture.linked-documents]
    when:
      operation: docs-control-plane.buildBoundedDefinitionContext
    then:
      returns:
        discovery.plan: contains_source_backed_graph_candidates
        discovery.projections: deterministically_sorted
      invariants:
        [
          metadata_only_discovery,
          discovery_candidates_are_bounded,
          no_body_read_before_route_freeze,
        ]

  - id: docs-control-plane.definition-context.source-transport.v1
    owner_system: docs-control-plane
    contract_kind: dependency-contract
    mode: read
    given:
      predicates: [definition-source_contract_available, source_transport_is_local_or_http]
      fixtures: [definition-context.fixture.definition-addressing]
    when:
      operation: docs-control-plane.def.context.bounded
    then:
      returns:
        source_mode: local_or_server
        working_context.status: closed
        manifest.digest: present
      invariants:
        [transport_is_hidden_behind_def_data_source, bounded_route_freeze_is_transport_invariant]
```
