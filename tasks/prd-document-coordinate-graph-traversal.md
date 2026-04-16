[PRD]
# PRD: Document Coordinate Graph Traversal

## Overview

Build a system-first document coordinate graph traversal layer on top of the existing docs control plane. The goal is not to simplify authored meaning into a small UX taxonomy, but to preserve precise system classification so impact analysis, PRD context generation, source/evidence lookup, rule discovery, and completion sync can traverse the right relationship axes without broad topic drift.

The system will normalize existing `DocumentEnvelope` links, sources, tasks, evidence, and metadata into canonical traversal axes. Authored document vocabulary stays source-owned; the control plane adds a traversal index and query engine that can expose exact axes, directions, depth, limits, truncation, and edge reasons. Presets are allowed only as convenience views over the more precise canonical axes.

`qa-sdk def` and `qa-sdk docs` remain separate surfaces. `qa-sdk def topdown`, `qa-sdk def bottomup`, and `qa-sdk def find-by-file` are definition-catalog primitive queries over the definition datasource. `qa-sdk docs graph` is a cross-document coordinate graph over definition markdown, PRD markdown, ralph PRD JSON, ralph session state, source paths, and artifact evidence adapters. This PRD must not replace or reinterpret `qa-sdk def`; it adds a broader docs control-plane graph.

## Goals

- Define canonical traversal axes for document coordinate graph queries.
- Preserve precise system semantics for trace, source, evidence, rule/constraint, and role traversal.
- Build a graph index from existing docs control-plane envelopes without changing source schemas.
- Resolve source path targets as first-class graph nodes instead of falling back to full-document collection.
- Add a `qa-sdk docs graph` CLI with axis, direction, depth, limit, preset, and JSON/text output.
- Integrate traversal semantics into `docs status`, `docs collect`, `docs prd context`, and `docs prd sync-completion`.
- Document how `rule`, `test`, `memo`, `knowledge`, PRD, session, source, and evidence nodes participate in traversal.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and graph CLI tests
- `pnpm --filter @qa-sdk/cli test -- def` - definition CLI regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter definition-catalog test` - definition-catalog document graph regression
- `pnpm --filter definition-catalog typecheck` - definition-catalog type checking
- `node packages/cli/dist/index.js def validate` - repository definition validation

No browser verification is required.

## User Stories

### US-001: Define Canonical Traversal Axis Taxonomy

**Description:** As a docs control-plane maintainer, I want canonical traversal axes defined separately from authored link vocabulary so the system can classify relationships precisely without changing source document schemas.

**Acceptance Criteria:**
- [x] Define canonical axes: `composition`, `refinement`, `dependency`, `constraint`, `trace`, `source`, `evidence`, `role`, and `context`.
- [x] Define traversal direction as `out`, `in`, and `both`, separate from axis names.
- [x] Define node roles separately from edges: `spec`, `todo`, `plan`, `rule`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json`, `ralph-session`, `source`, `evidence`, and `section` where needed.
- [x] Document that authored link vocabulary remains source-owned and is not replaced by canonical axes.
- [x] Add TypeScript types for axes, directions, graph node kinds, graph edge kinds, traversal presets, and traversal result summaries.
- [x] Add tests verifying canonical axis constants, preset definitions, and authored-to-axis mapping tables.

### US-002: Normalize Existing Links, Sources, Tasks, And Evidence Into Graph Edges

**Description:** As a graph traversal implementer, I want existing `DocumentEnvelope` data normalized into typed graph edges so traversal can use precise axes without requiring authors to rewrite links.

**Acceptance Criteria:**
- [x] Map `contains` links to `composition`.
- [x] Map `refines` links to `refinement`.
- [x] Map `depends_on` links to `dependency`.
- [x] Map `constrains` links and `.rule.md` relationships to `constraint`.
- [x] Map `traces_to`, PRD story relationships, and ralph session-to-PRD relationships to `trace`.
- [x] Map document `sources`, code references, source paths, and verification source paths to `source`.
- [x] Map artifact evidence `verifies`, `materializes_output`, `verificationRefs`, and quality/activation evidence references to `evidence`.
- [x] Map same-family role relationships between spec/todo/plan/rule/test/memo/knowledge/PRD/session documents to `role`.
- [x] Map tags, scope/aspect/layer, and knowledge/memo context only to `context`; context must be lowest priority and excluded from strict implementation presets.
- [x] Preserve edge reason, adapter id, raw source pointer, source document id/path, and target node id/path on every normalized edge.

### US-003: Build Document Coordinate Graph Index

**Description:** As a docs CLI user, I want the control plane to build a stable graph index from document envelopes so graph traversal can be fast, deduplicated, and explainable.

**Acceptance Criteria:**
- [x] Add a graph index module under `packages/cli/src/lib/docs-control-plane/`.
- [x] Build graph nodes for documents, tasks, source paths, evidence records, and optional sections when needed.
- [x] Build graph edges from normalized relationship projections.
- [x] Dedupe equivalent nodes and edges while preserving multiple reasons when more than one source relation supports an edge.
- [x] Provide lookup by stable id, family id, path, source path, task id, artifact id, and evidence ref.
- [x] If the target is a repository-relative or absolute source path, resolve it to a `source` graph node even when no document id matches that path.
- [x] Source path target resolution must not return the full repository when there is no source-map coverage.
- [x] Add cycle-safe adjacency indexes for outgoing and incoming traversal.
- [x] Add unit tests with mixed definition markdown, PRD JSON, ralph session, source path, rule, and evidence fixtures.

### US-004: Implement Axis Traversal Engine

**Description:** As a traversal user, I want graph traversal to follow explicit axes, direction, depth, and limits so broad graph searches are deliberate and bounded.

**Acceptance Criteria:**
- [x] Implement traversal input with target, axes, direction, depth, limit, includeContext flag, and preset.
- [x] Traverse only selected axes unless a preset expands them.
- [x] Support `out`, `in`, and `both` directions.
- [x] Support `depth` with default `1` and a safe maximum.
- [x] Support `limit` with default cap and `truncated` plus omitted count when capped.
- [x] Return visited nodes, traversed edges, paths from target, depth for each node, and edge reasons.
- [x] Prevent infinite loops on cycles.
- [x] Add tests for each axis, direction, depth, limit, and truncation behavior.

### US-005: Add Role Traversal Including Rule/Test/Memo/Knowledge

**Description:** As a documentation maintainer, I want role traversal to expose spec/todo/plan/rule/test/memo/knowledge family members without treating role as an authored link type.

**Acceptance Criteria:**
- [x] `role` traversal shows same-family role members by document kind and extension.
- [x] `.rule.md` appears as a role node and also contributes to `constraint` axis where it constrains a spec family.
- [x] `.test.md`, `.memo.md`, and `knowledge` documents appear in role traversal when in the same family or linked as family context.
- [x] Missing expected roles can be reported as optional absence metadata without becoming errors.
- [x] Text and JSON output group role nodes by role type.
- [x] Add tests for a family containing spec, todo, plan, rule, test, memo, and knowledge fixtures.

### US-006: Add Source, Evidence, And Trace Traversal

**Description:** As an impact-analysis user, I want source, evidence, and trace axes to remain separate so the system can distinguish implementation location, verification proof, and work history.

**Acceptance Criteria:**
- [x] Source traversal can start from a source path and find documents/evidence that reference that path.
- [x] Source traversal can start from a document and find implementation and test paths it declares.
- [x] Source traversal with no matching source-map coverage returns a bounded result with `source-map-missing` diagnostic or limitation metadata.
- [x] Source traversal documents that it is powered by docs control-plane adapters and is distinct from `qa-sdk def find-by-file`.
- [x] Evidence traversal can start from an artifact/evidence record and find verified docs, materialized outputs, source refs, and verification refs.
- [x] Evidence traversal can start from a document and find related evidence records.
- [x] Trace traversal can connect PRD markdown, ralph PRD JSON, ralph session, PRD stories, TODO items, and traced docs without collapsing them into source or evidence.
- [x] Add tests proving `trace`, `source`, and `evidence` return different edge sets for the same target when applicable.

### US-007: Add `qa-sdk docs graph` CLI

**Description:** As a maintainer, I want a CLI graph command so I can inspect document coordinate graph traversal directly before using it in higher-level commands.

**Acceptance Criteria:**
- [x] Add `qa-sdk docs graph <target>` to the docs command group.
- [x] Support `--axis <csv>`, `--direction out|in|both`, `--depth <n>`, `--limit <n>`, `--preset <name>`, and `--json`.
- [x] Text output includes target, axes, direction, node count, edge count, truncated state, and edge reasons.
- [x] JSON output includes traversal input, nodes, edges, paths, counts, `truncated`, and `omittedCount`.
- [x] Unknown axis, direction, or preset returns structured CLI errors.
- [x] Add root dispatch/help tests for `qa-sdk docs graph`.
- [x] Add command tests for composition, role, source, evidence, trace, and preset traversal.
- [x] Add command tests proving source path targets do not return full-repository status or collect results.

### US-008: Define And Implement Traversal Presets

**Description:** As an operator, I want convenience presets for common workflows without losing access to precise canonical axes.

**Acceptance Criteria:**
- [x] Define `family`, `implementation`, `review`, `impact`, and `prd-completion` presets.
- [x] `family` expands to role plus composition within safe depth.
- [x] `implementation` expands to trace, source, and evidence.
- [x] `review` expands to dependency, constraint, evidence, and role.
- [x] `impact` uses reverse dependency, reverse trace, reverse source, and reverse evidence as applicable.
- [x] `prd-completion` uses trace/source/evidence only and excludes context by default.
- [x] Presets must be documented as convenience views, not internal canonical axes.
- [x] Add tests confirming each preset expands to the expected axes/direction/default depth.

### US-009: Integrate Graph Traversal With Existing Docs Commands

**Description:** As a docs control-plane maintainer, I want status, collect, PRD context, and PRD completion sync to use traversal semantics consistently so they stop duplicating ad hoc related-document logic.

**Acceptance Criteria:**
- [x] `docs status` keeps family/role-limited behavior and does not broaden into context search by default.
- [x] `docs collect` accepts a graph mode or traversal options while preserving current family default.
- [x] `docs prd context <exact-doc-or-path>` uses graph traversal with bounded role, dependency, source, and evidence axes.
- [x] `docs prd context <free text>` remains search-first and must not silently traverse the full graph.
- [x] `docs prd sync-completion` uses trace/source/evidence axes only and excludes broad context/topic traversal.
- [x] Existing status/collect/drift/PRD tests remain green or are updated to assert the new traversal-backed behavior.
- [x] Existing `qa-sdk def topdown`, `qa-sdk def bottomup`, and `qa-sdk def find-by-file` behavior remains unchanged and is not routed through docs graph.

### US-010: Add Guardrails For Large Graph Traversals

**Description:** As an operator, I want traversal results to be bounded and explain truncation so a 1000-document repository stays usable.

**Acceptance Criteria:**
- [x] Default traversal limit prevents accidental full-repository dumps.
- [x] `--limit` can lower or raise the cap within a safe maximum.
- [x] `--depth` default and maximum are documented and enforced.
- [x] Results include `truncated: true` and omitted counts when caps are hit.
- [x] Text output warns when context/search axes cause broad traversal.
- [x] Add tests for limit, depth, truncation, and broad-context warnings.

### US-011: Document Coordinate Graph Traversal Semantics

**Description:** As a documentation author, I want the traversal model documented so authors understand source-owned links while the system handles precise canonical classification.

**Acceptance Criteria:**
- [x] Update `docs-control-plane.spec.md` with canonical axes and direction semantics.
- [x] Document that `trace`, `source`, and `evidence` remain separate system axes.
- [x] Document that `rule` is a document role and contributes to the `constraint` axis.
- [x] Document authored link vocabulary versus normalized traversal axes.
- [x] Document the distinction between `qa-sdk def` primitive graph queries and `qa-sdk docs graph` cross-document coordinate traversal.
- [x] Document source path target resolution and the difference from `qa-sdk def find-by-file`.
- [x] Document presets as convenience views only.
- [x] Add usage examples for `docs graph` with composition, source, evidence, role, and PRD trace traversal.

## Functional Requirements

- FR-1: The system must preserve nine canonical traversal axes internally.
- FR-2: Authored link vocabulary must remain source-owned and must not be replaced by traversal axes.
- FR-3: Direction must be independent from axis.
- FR-4: Role traversal must include `rule`, `test`, `memo`, and `knowledge` where present.
- FR-5: Source, trace, and evidence traversal must remain distinct.
- FR-6: Graph traversal must include edge reasons and raw source pointers.
- FR-7: Traversal output must be bounded by depth and limit with truncation metadata.
- FR-8: Existing docs control-plane commands must avoid broad traversal unless explicitly requested.
- FR-9: No source documents may be mutated by this PRD.
- FR-10: Source path targets must resolve as source graph nodes and must not fall back to full-repository collection.
- FR-11: `qa-sdk def` primitive commands must remain behaviorally independent from `qa-sdk docs graph`.

## Non-Goals

- Adding new authored link types such as `realizes` or `relates_to`.
- Replacing `qa-sdk def topdown` or `qa-sdk def bottomup`.
- Changing `qa-sdk def find-by-file` behavior or its definition-catalog code-reference datasource.
- Implementing pack authoring commands.
- Adding REST or remote document graph services.
- Automatically adding source-map comments or rewriting frontmatter.
- Applying metadata transforms.

## Technical Considerations

- Existing graph input:
  - `packages/cli/src/lib/docs-control-plane/types.ts`
  - `DocumentEnvelope.links`
  - `DocumentEnvelope.sources`
  - `DocumentEnvelope.tasks`
  - `DocumentEnvelope.evidence`
  - adapter metadata
- Likely new files:
  - `packages/cli/src/lib/docs-control-plane/graph-types.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-build.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-traverse.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-presets.ts`
- Existing command file to extend:
  - `packages/cli/src/commands/docs.ts`
  - `packages/cli/src/command-groups/docs.commands.ts`
- Existing tests to extend:
  - `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`
  - `packages/cli/src/commands/docs.test.ts`
- Existing commands that must remain independent:
  - `qa-sdk def topdown`
  - `qa-sdk def bottomup`
  - `qa-sdk def find-by-file`

## Success Metrics

- `qa-sdk docs graph` can answer composition, dependency, constraint, trace, source, evidence, role, and context questions with explicit edge reasons.
- Source path traversal no longer falls back to full-repository collection.
- Source path traversal reports either matched source/evidence/docs nodes or a clear source-map-missing limitation.
- PRD context and sync-completion stop using broad topic matching when an exact target exists.
- Rule documents are visible as role nodes and constraint-axis participants.
- Large traversal results report truncation instead of silently dumping the repository.

## Open Questions

- Should `context` axis be disabled by default for all presets except explicit search/context queries?
- Should `qa-sdk docs graph` include section-level nodes in the first version, or keep sections as metadata until a later PRD?
[/PRD]
