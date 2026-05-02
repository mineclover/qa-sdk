[PRD]
# PRD: Docs Graph Result Ranking And Filtering

## Overview

The docs control plane can already traverse document graphs through axes such as `role`, `composition`, `trace`, `source`, and `evidence`. However, broad graph results can still be noisy: relevant documents are found, but the system does not consistently rank stronger results ahead of weaker ones, filter result views by role/kind/axis/actionability, or summarize large result sets for review and PRD authoring.

This PRD adds a rule-based graph result reranking layer on top of existing graph traversal. It follows the standard retrieval/rescore pattern: traversal is the retrieval phase, and ranking/filtering is a post-traversal rescore/view phase. It must not change traversal semantics. It ranks, filters, and summarizes graph results after traversal so `docs graph`, `docs collect --graph`, and `docs prd context` can surface the most useful documents first while keeping the full raw traversal output available.

For backward compatibility, filters must not remove existing raw traversal fields such as `nodes`, `edges`, and `paths` from JSON output. Filtering and ranking are exposed through additive views such as `rankedNodes`, `filteredNodes`, `ranking`, or `summary`.

## Goals

- Add a reusable rule-based graph result reranking model.
- Add graph result filtering by kind, role, axis, diagnostic state, archive state, and follow-up category.
- Add graph result summaries for large results.
- Preserve existing graph traversal semantics and raw JSON fields.
- Improve `docs graph` and `docs collect --graph` output without breaking current JSON shape.
- Improve PRD authoring context ordering so actionable and strong context appears first.
- Keep `--family-only` behavior intact.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and graph CLI tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `node packages/cli/dist/index.js def validate` - definition graph validation

Operational checks:

- `node packages/cli/dist/index.js docs graph docs-control-plane --preset family --json`
- `node packages/cli/dist/index.js docs graph programming-artifact-ontology-system --preset family --json`
- `node packages/cli/dist/index.js docs collect programming-artifact-ontology-system --graph --preset family --json`
- `node packages/cli/dist/index.js docs collect programming-artifact-ontology-system --graph --preset family --family-only --json`
- `node packages/cli/dist/index.js docs prd context docs-control-plane --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-topdown-lifecycle-inventory-alignment.json --json`

No browser verification is required.

## User Stories

### US-001: Define Graph Result Ranking Model

**Description:** As a docs operator, I want a clear ranking model for graph results so that stronger document relationships appear before weak or broad matches.

**Acceptance Criteria:**
- [x] Add a graph result ranking module that runs after traversal.
- [x] Ranking follows a retrieval/rescore pattern: traversal first, post-traversal reranking second.
- [x] Ranking does not modify traversal paths or edge discovery.
- [x] Rank factors include target node, path distance, axis, node kind, role, archive state, diagnostics, and follow-up category where available.
- [x] Same-family role docs rank above weak trace/context results.
- [x] Source/evidence-linked docs rank above broad context-only docs.
- [x] Archive/historical docs rank lower by default.
- [x] Ranking result includes `rank`, `score`, and `strength` or equivalent fields.
- [x] Ranking explanation includes factor-level reason metadata sufficient to debug score decisions.
- [x] Unit tests cover rank ordering for role, source, evidence, trace, context, and archive examples.

### US-002: Add Ranked Graph Result Shape

**Description:** As a CLI consumer, I want graph JSON output to expose ranking metadata without breaking existing fields.

**Acceptance Criteria:**
- [x] `docs graph --json` keeps existing `nodes`, `edges`, `paths`, `counts`, `diagnostics`, and truncation fields.
- [x] Additive ranking metadata is exposed under a new field such as `rankedNodes` or `ranking`.
- [x] Ranking metadata includes node id, rank, score, strength, and reason summary.
- [x] Ranked output includes factor/explanation metadata sufficient to debug score decisions.
- [x] Raw `nodes` ordering and membership remain available for compatibility.
- [x] Existing tests expecting current graph fields remain valid.
- [x] Tests verify ranked output is deterministic.

### US-003: Add Graph Result Filters

**Description:** As a docs operator, I want to filter graph result views so that I can inspect only the roles, kinds, axes, or follow-up categories relevant to a review.

**Acceptance Criteria:**
- [x] Add filter parsing for relevant docs graph commands.
- [x] Support filtering by document kind, for example `--kind spec,todo,plan`.
- [x] Support filtering by role where role metadata exists, for example `--role spec,todo,plan`.
- [x] Support filtering by axis after traversal, for example `--filter-axis source,evidence`.
- [x] Document that `--axis` selects traversal axes, while `--filter-axis` filters the post-traversal result view.
- [x] Support active-view archive exclusion through ranked/filtered views without removing raw traversal nodes.
- [x] Support including archive documents explicitly, for example `--include-archive`.
- [x] Support filtering follow-up category where available, for example `--follow-up-category actionable,deferred`.
- [x] Filtering does not change traversal; it only changes additive returned/ranked/filtered views.

### US-004: Add Graph Result Summary

**Description:** As a reviewer, I want large graph results summarized by role, axis, kind, and follow-up category so I can understand the graph without reading every node.

**Acceptance Criteria:**
- [x] Add graph result summary generation after traversal and filtering.
- [x] Summary includes counts by node kind.
- [x] Summary includes counts by traversal axis.
- [x] Summary includes counts by document role where available.
- [x] Summary includes counts by follow-up category where available.
- [x] Summary includes archive excluded/included counts when applicable.
- [x] Summary includes diagnostics count.
- [x] Text output shows compact summary before listing nodes.
- [x] JSON output exposes summary under an additive field.

### US-005: Apply Ranking And Filtering To `docs graph`

**Description:** As a docs graph user, I want `docs graph` to show ranked and optionally filtered views while preserving full traversal semantics.

**Acceptance Criteria:**
- [x] `docs graph` supports ranking by default.
- [x] `docs graph --json` includes ranking and summary fields.
- [x] `docs graph` text output shows top ranked nodes first or clearly labels ranked view output.
- [x] Raw node/edge/path traversal information remains available in JSON.
- [x] Existing graph traversal diagnostics remain visible.
- [x] Existing source-map-missing bounded behavior remains unchanged.
- [x] Tests cover ranked source-path graph output and missing source-path output.

### US-006: Apply Ranking And Filtering To `docs collect --graph`

**Description:** As a docs collect user, I want graph collection output to be ranked and summarized so broad graph collection is easier to review.

**Acceptance Criteria:**
- [x] `docs collect --graph` includes graph ranking metadata in JSON output.
- [x] `docs collect --graph` text output remains concise.
- [x] `docs collect --graph --family-only` remains bounded and unchanged except for additive summary/ranking metadata.
- [x] Filtering options work with collect graph mode.
- [x] Tests cover broad graph collect and family-only collect behavior.

### US-007: Apply Ranking To PRD Authoring Context

**Description:** As a planner, I want `docs prd context` to present stronger context sources first so new PRDs are grounded in the most relevant specs, TODOs, plans, sources, and evidence.

**Acceptance Criteria:**
- [x] `docs prd context <exact-doc>` uses ranked graph context for related documents.
- [x] Same-family and direct dependency/role documents appear before broad trace/context documents.
- [x] Actionable TODO context appears before deferred/parking-lot context where applicable.
- [x] Archive PRDs remain excluded by default.
- [x] JSON `contextSources` includes ranking reason or score if available.
- [x] Existing PRD context tests pass or are updated for ranking order.

### US-008: Preserve Traversal Semantics And Backward Compatibility

**Description:** As a maintainer, I want ranking/filtering to be a consumption layer only so existing graph traversal behavior remains stable.

**Acceptance Criteria:**
- [x] No changes to authored link normalization semantics.
- [x] No changes to canonical traversal axis definitions.
- [x] No changes to graph edge construction except additive metadata if required.
- [x] Existing graph traversal unit tests continue to pass.
- [x] Full unfiltered traversal remains accessible in JSON output.
- [x] Reranking is rule-based and deterministic for the same graph result and options.
- [x] Document that ranking/filtering happens after traversal.

### US-009: Document Graph Ranking And Filtering

**Description:** As a future maintainer, I want docs explaining ranking and filtering semantics so graph output remains predictable.

**Acceptance Criteria:**
- [x] Update docs-control-plane spec or README with ranking model.
- [x] Document filter options and their scope.
- [x] Document that traversal and ranking are separate phases.
- [x] Document that raw traversal fields remain available even when filtered/ranked views are present.
- [x] Document that reranking is rule-based post-traversal rescore, not semantic/vector/LLM reranking.
- [x] Document the distinction between `--axis` traversal selection and `--filter-axis` view filtering.
- [x] Document archive/default active inventory behavior.
- [x] Document examples for source, role, evidence, and PRD context ranking.
- [x] Do not claim ranking changes graph truth; it only changes result consumption.

### US-010: Verify Ranking And Filtering Operationally

**Description:** As a reviewer, I want command evidence that ranking/filtering works on real repository data.

**Acceptance Criteria:**
- [x] Run `docs graph docs-control-plane --preset family --json` and verify ranking/summary exist.
- [x] Run `docs graph programming-artifact-ontology-system --preset family --json` and verify broad results are summarized.
- [x] Run `docs collect programming-artifact-ontology-system --graph --preset family --json`.
- [x] Run `docs collect programming-artifact-ontology-system --graph --preset family --family-only --json`.
- [x] Run at least one source path graph query and verify source-map behavior remains bounded.
- [x] Run `docs prd context docs-control-plane --json` and verify ranked context ordering.
- [x] Run all quality gates.
- [x] Record any residual noise or follow-up candidates in docs-control-plane TODO.

## Functional Requirements

- FR-1: Ranking must run after traversal.
- FR-2: Filtering must run after traversal.
- FR-3: Existing graph traversal fields must remain available.
- FR-4: Ranking/filtering metadata must be additive.
- FR-5: Result ordering must be deterministic.
- FR-6: Active inventory views should exclude archive docs by default where applicable.
- FR-7: Users must be able to include archive docs explicitly in ranked/filtered views.
- FR-8: `--family-only` behavior must remain bounded.
- FR-9: Source path missing behavior must remain bounded and diagnostic-based.
- FR-10: PRD context must prefer stronger context sources without losing traceability.
- FR-11: Reranking must expose explanation metadata for each ranked node.
- FR-12: Reranking must be deterministic for the same graph result and options.
- FR-13: Reranking must be rule-based; LLM/vector semantic reranking is out of scope.

## Non-Goals

- Changing graph traversal algorithms.
- Changing canonical graph axes.
- Changing definition-catalog validation.
- Implementing a new graph database.
- Adding write behavior.
- Auto-promoting TODO/spec/PRD state.
- Solving all source-map gaps.
- LLM, embedding, vector, or semantic reranking.
- Removing or replacing raw traversal `nodes`, `edges`, or `paths` JSON fields.

## Technical Considerations

- Likely files:
  - `packages/cli/src/lib/docs-control-plane/graph-rank.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-filter.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-summary.ts`
  - `packages/cli/src/commands/docs.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-traverse.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-scope.ts`
- Reuse existing read models:
  - `role-matrix.ts`
  - `follow-ups.ts`
  - `completed-records.ts`
  - `family-scope.ts`
- Keep graph traversal output intact and add ranked/filtered views beside it.

## Success Metrics

- Broad graph output becomes easier to review.
- Strong same-family/source/evidence results appear before weak trace/context results.
- Filters reduce graph output views without changing raw traversal.
- PRD context becomes more relevant and less noisy.
- Existing graph and docs tests remain green.
- No default drift or source-map regression is introduced.

## Open Questions

- Should ranked text output show only top ranked nodes by default, or list all nodes with rank?
- Should follow-up category filtering apply only to TODO documents or any document with nextFollowUps metadata?
- Should archive exclusion apply to all graph commands by default or only inventory-oriented ranked/filtered views?
[/PRD]
