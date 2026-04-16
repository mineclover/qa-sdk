---
def:
  id: docs-control-plane-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, testing, contract]
  links:
    - target: docs-control-plane
      type: traces_to
    - target: docs-control-plane-plan
      type: refines
---

# Docs Control Plane — TODO

## 목적 ^purpose

`qa-sdk docs` control plane의 남은 실행 작업을 추적한다. 목표는 완료된 adapter/graph traversal 기반 위에서 source-map coverage, pack authoring, graph ranking/filtering, PRD completion sync precision, section-level graph를 순차적으로 닫는 것이다.

## 구현 항목

- [ ] Document Source Map Coverage Expansion
  - [x] docs-control-plane command, graph, adapter, and PRD conversion source files have conservative frontmatter source coverage
  - [x] ontology CLI split modules with authoritative file-level owners have source graph coverage
  - [x] operational/authorization pack source files have pack-family source coverage
  - [x] `qa-sdk docs graph <source-path> --axis source --direction in` returns related docs/evidence for selected covered targets without full-repository fallback
  - [x] `qa-sdk def find-by-file <source-path>` returns explicit mappings where authoritative source-map is available
    - [x] compatible entries are top-level `source:` / `sources:` values that parse as `packages/...` file refs and whose supporting docs collapse to one boundary anchor after `qa-sdk def sync`
    - [x] after `qa-sdk def sync`, `packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts` resolves to `docs-control-plane`
    - [x] after `qa-sdk def sync`, `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` resolves to `programming-artifact-ontology-system`
  - [x] source-map gaps remain explicit TODOs instead of broad graph fallback
  - [x] US-008 operational graph verification recorded: selected covered source paths resolve through `source` inbound traversal, and `packages/cli/src/commands/ontology/navigation-diff.ts` stays bounded at one synthetic source node, zero edges, one path, and one `source-map-missing` diagnostic
  - [ ] Remaining source-map gaps
    - [ ] `packages/cli/src/lib/docs-control-plane/index.ts` remains a barrel-only facade gap; add source coverage only if facade-level lookup becomes an operational requirement
    - [ ] `activation.ts`, `artifact-registry.ts`, and `prompt-extract-artifact.ts` remain ambiguous for `def find-by-file` between `operational-ontology-registry-allocation` and `programming-artifact-ontology-system`; close with symbol-level `@def.boundary` / `@def.doc` only when an authoritative boundary is chosen
    - [ ] `ingest.ts`, `status.ts`, and `navigation-diff.ts` still have no authoritative file-level source-map owner; keep `docs graph` traversal bounded with `source-map-missing` until ownership is documented

- [ ] Ontology Pack Authoring Control Plane
  - [ ] pack scaffold command
  - [ ] pack validate command
  - [ ] docs family scaffold: spec/todo/plan/rule/test/memo
  - [ ] known pack registration candidate generation
  - [ ] source-map candidate generation for generated pack files

- [ ] Graph Result Ranking And Filtering
  - [ ] rank by axis, edge reason, role, and path distance
  - [ ] filter by role/kind/axis/diagnostic
  - [ ] context axis ranking
  - [ ] graph output summarization for large results

- [ ] PRD Completion Sync Precision
  - [ ] graph-axis based candidate scoring
  - [ ] `--strict`
  - [ ] `--family-only`
  - [ ] `--evidence-only`
  - [ ] blocked promotion explanation improvements

- [ ] Section-Level Graph Nodes
  - [ ] purpose/overview/constraint/scenario matrix section nodes
  - [ ] section-level evidence mapping
  - [ ] section-level traversal presets if needed
