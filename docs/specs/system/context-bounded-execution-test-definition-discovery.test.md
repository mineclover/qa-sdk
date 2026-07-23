---
def:
  id: context-bounded-execution-test-definition-discovery
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
# Context-Bounded Execution — Definition discovery 검증

## 목적 ^purpose

lazy resolution, graph discovery와 local/server source transport의 unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-docs-control-plane-bounded-definition-context-lazy-resolution
    contract: docs-control-plane.definition-context.lazy-resolution.v1
    level: integration
    assertions:
      [
        then.returns.selected_routes,
        then.returns.working_context,
        then.invariants.blocked_discovery_does_not_read_body_or_boundary,
        then.invariants.only_selected_routes_are_resolved,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-graph-discovery
    contract: docs-control-plane.definition-context.graph-discovery.v1
    level: integration
    assertions:
      [
        then.returns.discovery.plan,
        then.returns.discovery.projections,
        then.invariants.metadata_only_discovery,
        then.invariants.discovery_candidates_are_bounded,
      ]
    test_file: packages/cli/src/lib/context-runtime/definition-document-context.test.ts

  - id: TU-docs-control-plane-bounded-definition-context-source-transport
    contract: docs-control-plane.definition-context.source-transport.v1
    level: integration
    assertions:
      [
        then.returns.source_mode,
        then.returns.working_context.status,
        then.returns.manifest.digest,
        then.invariants.transport_is_hidden_behind_def_data_source,
      ]
    test_file: packages/definition-data-source/src/factory.test.ts
implementation_units:
  - id: IU-docs-control-plane-bounded-context-lazy-resolution
    contract: docs-control-plane.definition-context.lazy-resolution.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:buildBoundedDefinitionContext
    effects: [definition.route_freeze, definition.lazy_source_resolution]

  - id: IU-docs-control-plane-bounded-context-graph-discovery
    contract: docs-control-plane.definition-context.graph-discovery.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/context-runtime/definition-document-context.ts:createDefinitionGraphDiscoveryCandidates
    effects: [definition.source_backed_discovery_candidates]

  - id: IU-docs-control-plane-definition-source-transport
    contract: docs-control-plane.definition-context.source-transport.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/definition-data-source/src/factory.ts:createDataSource
    effects: [definition.local_source, definition.http_source]

  - id: IU-docs-control-plane-definition-http-source
    contract: docs-control-plane.definition-context.source-transport.v1
    unit_kind: repository
    owned_by: docs-control-plane
    source_target: packages/definition-data-source/src/server-data-source.ts:ServerDataSource
    effects: [definition.http_source]
```
