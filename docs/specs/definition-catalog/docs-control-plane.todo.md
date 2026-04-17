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

### Completed — 완료 기록

- [x] Document Source Map Coverage Expansion
  - [x] docs-control-plane command, graph, adapter, and PRD conversion source files have conservative frontmatter source coverage
  - [x] ontology CLI split modules with authoritative file-level owners have source graph coverage
  - [x] operational/authorization pack source files have pack-family source coverage
  - [x] `qa-sdk docs graph <source-path> --axis source --direction in` returns related docs/evidence for selected covered targets without full-repository fallback
  - [x] `qa-sdk def find-by-file <source-path>` returns explicit mappings where authoritative source-map is available
    - [x] compatible entries are top-level `source:` / `sources:` values that parse as `packages/...` file refs and whose supporting docs collapse to one boundary anchor after `qa-sdk def sync`
    - [x] after `qa-sdk def sync`, `packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts` resolves to `docs-control-plane`
    - [x] after `qa-sdk def sync`, `packages/cli/src/commands/ontology/activation.ts` resolves to `operational-ontology-registry-allocation`
    - [x] after `qa-sdk def sync`, `packages/cli/src/commands/ontology/artifact-registry.ts` resolves to `programming-artifact-ontology-system`
    - [x] after `qa-sdk def sync`, `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` resolves to `programming-artifact-ontology-system`
    - [x] after `qa-sdk def sync`, `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` resolves to `programming-artifact-ontology-system`
  - [x] source-map gaps remain explicit TODOs instead of broad graph fallback
  - [x] US-008 operational graph verification recorded: selected covered source paths resolve through `source` inbound traversal, and `packages/cli/src/commands/ontology/navigation-diff.ts` stays bounded at one synthetic source node, zero edges, one path, and one `source-map-missing` diagnostic

- [x] Ontology Pack Authoring Control Plane
  - [x] pack scaffold command
  - [x] pack validate command
  - [x] docs family scaffold: spec/todo/plan/rule/test/memo
  - [x] known pack registration candidate generation
  - [x] source-map candidate generation for generated pack files

- [x] Docs And Ontology Pack Reuse Refactor
  - [x] docs lifecycle parser, completed record detection, follow-up ranking, role matrix, and family scope logic are reusable library modules
  - [x] ontology pack scaffold renderers, planning helpers, validate loader, runtime validation, and readiness checks are split into focused modules
  - [x] `docs.ts` and `ontology.ts` remain command assembly surfaces for the refactored behavior
  - [x] command assembly, readiness result, and dry-run/write conventions are documented

- [x] Graph Result Ranking And Filtering
  - [x] rank by axis, edge reason, role, and path distance
  - [x] filter by role/kind/axis/diagnostic and follow-up category
  - [x] context axis ranking for exact-target PRD authoring context
  - [x] graph output summarization for large results
  - [x] US-010 operational verification recorded ranked/summary graph output, collect graph output, family-only bounds, source-map bounds, PRD context ranking, drift output, and quality gates on real repository data

### Actionable — 실행 가능

- [ ] PRD Completion Sync Precision
  - [x] `docs status` follows module composition so contained TODO docs can surface as follow-up even when they do not share the same filename family
  - [x] `docs prd sync-completion` excludes archived PRD documents from affected docs unless the archived PRD is the explicit target
  - [x] `docs prd sync-completion --family-only` limits affected docs to explicit PRD family, directly linked role-matrix docs, and active same-family role context
  - [ ] graph-axis based candidate scoring
  - [ ] `--strict`
  - [ ] `--evidence-only`
  - [ ] blocked promotion explanation improvements

### Deferred — 조건부 대기

- [ ] Remaining source-map gaps
  - [ ] `packages/cli/src/lib/docs-control-plane/index.ts` remains a barrel-only facade gap; add source coverage only if facade-level lookup becomes an operational requirement
  - [ ] `packages/cli/src/commands/ontology/ingest.ts`, `status.ts`, and `navigation-diff.ts` still have no authoritative file-level source-map owner; keep `docs graph` traversal bounded with `source-map-missing` until ownership is documented

- [ ] Graph result operational noise follow-ups
  - [ ] Bounded `source-map-missing` graph output reports `summary.diagnosticCounts.traversal=1`, but `summary.diagnosticCounts.bySeverity.info` remains `0`; decide whether traversal diagnostics should populate severity buckets in summaries
  - [ ] Broad family graphs still expose high raw `missingRoles` counts even when ranked/summary views are readable; consider a quieter missing-role report if reviewer noise persists

- [ ] Section-Level Graph Nodes
  - [ ] purpose/overview/constraint/scenario matrix section nodes
  - [ ] section-level evidence mapping
  - [ ] section-level traversal presets if needed

### Parking Lot — 후보 보관

현재 보관 후보 없음. 새 아이디어성 작업은 실행 조건이나 owner가 정해질 때까지 Actionable로 승격하지 않는다.
