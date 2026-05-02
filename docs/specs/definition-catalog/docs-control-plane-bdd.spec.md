---
def:
  id: docs-control-plane-bdd
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [testing, contract]
  links:
    - target: docs-control-plane
      type: refines
    - target: bdd-contract-schema
      type: depends_on
    - target: bdd-contract-cli
      type: depends_on
sources:
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts
  - packages/cli/src/commands/docs.ts
  - packages/core/src/schema/bdd-contract.schema.ts
  - packages/core/src/bdd-contract/compile-scenario.ts
---

# Docs Control Plane BDD

## 목적 ^purpose

`.cases.md`/`.test.md`의 fenced `yaml bdd` block을 읽어 `DocumentEnvelope.metadata.bdd`로 투영하고, `qa-sdk docs bdd ...` 명령이 BDD contract, test unit, implementation unit을 read-only로 노출하는 docs-control-plane 내부 behavior를 정의한다.

## Behavior authority

- Behavior semantics are owned by `bdd_contract` blocks.
- Event keys are referenced from event vocabulary or mapping packs; BDD does not create event vocabulary.
- Test and implementation units share the same `contract` id.
- `docs bdd ...` commands are read-only views and previews.

## Command surface ^defines

| command | output |
|---------|--------|
| `docs bdd list` | BDD contract list |
| `docs bdd validate` | BDD diagnostics across target scope |
| `docs bdd units` | contract id -> test/implementation unit groups |
| `docs bdd compile` | ScenarioSpec and/or PipeGraph preview |
| `docs bdd test-plan` | test skeleton preview |
| `docs bdd impl-plan` | implementation source-target preview |

## Implementation mapping

| responsibility | source |
|----------------|--------|
| YAML block extraction and schema diagnostics | `bdd-contract-extract.ts` |
| definition markdown adapter projection | `adapters/definition-markdown.ts` |
| BDD command assembly/output | `commands/docs.ts` |
| BDD core schema | `packages/core/src/schema/bdd-contract.schema.ts` |
| ScenarioSpec/PipeGraph compile | `packages/core/src/bdd-contract/compile-scenario.ts` |

## Verified behavior

The same behavior is specified in `docs-control-plane-cases`.

| contract | key expectation |
|----------|-----------------|
| `docs-control-plane.bdd.parse.valid-block.v1` | valid BDD block projects contracts, test units, implementation units |
| `docs-control-plane.bdd.parse.invalid-block-diagnostic.v1` | invalid block keeps document and emits diagnostic |
| `docs-control-plane.bdd.cli.list-contracts.v1` | list exposes contract ids |
| `docs-control-plane.bdd.cli.validate-contracts.v1` | validate reports pass/issues |
| `docs-control-plane.bdd.cli.units-grouped.v1` | units groups by contract id |
| `docs-control-plane.bdd.cli.compile-scenarios.v1` | compile emits deterministic scenario/pipe preview |
