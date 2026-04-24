---
def:
  id: docs-control-plane-graph
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [structural, graph, testing]
  links:
    - target: docs-control-plane
      type: refines
    - target: doc-envelope
      type: depends_on
sources:
  - packages/cli/src/lib/docs-control-plane/graph-types.ts
  - packages/cli/src/lib/docs-control-plane/graph-index.ts
  - packages/cli/src/lib/docs-control-plane/graph-normalize.ts
  - packages/cli/src/lib/docs-control-plane/graph-traverse.ts
  - packages/cli/src/lib/docs-control-plane/graph-presets.ts
  - packages/cli/src/lib/docs-control-plane/graph-scope.ts
  - packages/cli/src/lib/docs-control-plane/graph-rank.ts
  - packages/cli/src/lib/docs-control-plane/graph-filter.ts
  - packages/cli/src/lib/docs-control-plane/graph-summary.ts
  - packages/cli/src/lib/docs-control-plane/role-matrix.ts
  - packages/cli/src/commands/docs.ts
---

# Docs Control Plane Graph

## 목적 ^purpose

DocumentEnvelope 배열에서 canonical document graph를 만들고, traversal/ranking/filtering/summary view를 read-only로 제공한다. 이 문서는 docs-control-plane system 내부의 graph System behavior와 implementation source boundary를 소유한다.

## Canonical axes ^defines

Docs graph traversal은 authored vocabulary를 대체하지 않고 sidecar projection에 내부 traversal axis를 추가한다.

| axis | source |
|------|--------|
| `composition` | `contains`, section membership |
| `refinement` | `refines` |
| `dependency` | `depends_on` |
| `constraint` | `constrains`, `.rule.md` family constraint |
| `trace` | PRD/story/TODO/session lineage and trace-like links |
| `source` | source refs, source file targets, section-level source refs |
| `evidence` | proof/artifact/verification refs, section-level evidence refs |
| `role` | family role docs |
| `context` | tags/coordinates |

Direction is `out|in|both`. Edge truth stays canonical `fromNodeId -> toNodeId`; traversal direction may reverse a step but does not rewrite the edge.

## Implementation boundary

| unit | source |
|------|--------|
| graph vocabulary | `graph-types.ts` |
| node/edge index | `graph-index.ts` |
| authored-link normalization | `graph-normalize.ts` |
| traversal algorithm | `graph-traverse.ts` |
| presets | `graph-presets.ts` |
| traversal -> document scope | `graph-scope.ts` |
| ranking | `graph-rank.ts` |
| post-traversal filtering | `graph-filter.ts` |
| summary counts | `graph-summary.ts` |
| role/type matrix | `role-matrix.ts` |
| CLI rendering/JSON assembly | `commands/docs.ts` |

## Consumption rules

- Ranking/filtering/summary are post-traversal views. They do not change raw `nodes`, `edges`, or `paths`.
- `--axis` chooses traversal axes. `--filter-axis` filters the ranked view after traversal and cannot discover new nodes.
- `--include-archive` only changes active ranked/filtered views; raw traversal may still include archived nodes.
- Broad search/context traversal emits warnings and should prefer explicit axes for review workflows.
- `missingRoles[]` remains raw traversal metadata, but CLI consumption may group optional role gaps by family for quieter review output.
- `DocumentEnvelope.sections` are first-class graph nodes. Definition markdown markers such as `^purpose`, `^overview`, `^constraint` and heading sections such as `Scenario Matrix` may project section nodes when adapters expose them.
- Section nodes may point to source/evidence refs without changing document ownership. They remain read-only review anchors, not write targets.

## Presets

| preset | axes |
|--------|------|
| `family` | role + composition |
| `implementation` | trace + source + evidence |
| `review` | dependency + constraint + evidence + role |
| `impact` | incoming dependency + trace + source + evidence |
| `prd-completion` | trace + source + evidence |
