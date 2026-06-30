# Definition Service Semantic Grounding Design

> 2026-06-30. B-first implementation: add SQLite-backed semantic grounding to `definition-service`, then extract stable contracts into a future `semantic-indexing` package only after the service slice proves useful.

## Purpose

Implement the semantic indexing loop described by `coord-semantic-indexing-logic` in the first real consumer surface: document search in `definition-service`.

The goal is not to replace FTS, vector search, SQL generation, or the coordinate catalog. The goal is to make those retrieval paths share one semantic grounding layer: labels, aliases, coordinates, evidence, unresolved terms, and promotion proposals.

## Context

The new indexing ADR defines this loop:

```txt
raw docs / schema / events / code
  -> semantic extraction
  -> canonical labels / aliases / entities / relations
  -> 5Q axis decision
  -> prefix + version + address
  -> address index + text index + vector index + SQL metadata index
  -> RAG / text-to-SQL / user search grounding
  -> unresolved terms + feedback
  -> alias 추가 / entry 추가 / axis 승격 / version 전환
```

Current repository seams already cover many lower-level pieces:

| Concern | Current owner | Role in this design |
|---|---|---|
| Code/document extraction | `@qa-sdk/core/src/meta-semantic/*` | upstream raw semantic signal, not modified in phase 1 |
| Document-derived semantic coordinate labels | `deterministic-label-registry` | seed canonical labels and evidence refs |
| Axis/prefix/version/address math | `@qa-sdk/core`, `weighted-index`, `index-meta` | source of coordinate truth |
| Address reverse lookup | `address-index` | later materializer target |
| Tag lookup | `tag-search` | later materializer target for aliases/tags |
| Document FTS | `definition-service` `SearchService` | first search surface to ground |

The missing layer is orchestration: resolve natural language to semantic candidates, use those candidates to constrain search, and feed misses back as proposals.

## Chosen Approach

Start inside `definition-service` with a SQLite-backed semantic grounding slice.

This is intentionally service-first. A standalone `semantic-indexing` package is deferred until the slice has real query behavior and stable contracts. To keep extraction easy later, the implementation should separate pure types/functions from NestJS wiring and Drizzle/SQLite persistence.

## Non-Goals

- Do not add an in-memory semantic catalog as the primary path. The catalog and feedback loop are cumulative and should be SQLite-backed from the start.
- Do not modify `weighted-index` or `index-meta` for phase 1.
- Do not introduce vector embeddings in phase 1. Define the materializer contract so a vector target can be added later.
- Do not make a text-to-SQL generator. Ground schema/table/field candidates only.
- Do not auto-promote feedback into axis or prefix changes. Feedback is recorded as proposal data.

## Service Slice

Create a focused semantic grounding slice under `packages/definition-service/src/modules/semantic-grounding/`, with pure contracts/helpers in `packages/definition-service/src/core/semantic-grounding/` only when they do not need NestJS or SQLite imports.

| Component | First implementation responsibility |
|---|---|
| `SemanticCatalog` | Read canonical labels, aliases, coordinates, relations, and source evidence from SQLite. Seed from existing documents and deterministic label projections. |
| `SemanticResolver` | Normalize a user query, match labels/aliases/tags, return ranked candidates with confidence and evidence. |
| `IndexMaterializer` | Keep SQLite semantic tables and `SearchService` FTS rows aligned from definition docs. Address/tag/vector materialization remains an interface with only FTS-backed behavior in phase 1. |
| `GroundingPlanner` | Convert intent + candidates into a document search plan: semantic scope filters first, then FTS fallback. |
| `FeedbackPromoter` | Record unresolved terms, wrong-hit signals, failed SQL/schema grounding, and repeated query patterns as proposals. |

## SQLite Model

Add Drizzle-managed tables to `definition-service` rather than raw virtual tables, except for any future FTS table that SQLite requires outside Drizzle.

| Table | Key fields | Notes |
|---|---|---|
| `semantic_terms` | `term_id`, `kind`, `canonical_label`, `coordinate`, `prefix_id`, `version_id`, `address`, `doc_id`, `source_path`, `evidence_json` | Canonical semantic nodes. `coordinate` may be URN-style from deterministic labels or `prefix:v:address` from catalog/address_context. |
| `semantic_aliases` | `alias_id`, `term_id`, `alias`, `locale`, `source`, `confidence`, `created_at` | Query expression layer. Unique normalized alias per term/source. |
| `semantic_relations` | `relation_id`, `source_term_id`, `relation_type`, `target_term_id`, `evidence_json` | Lightweight graph for "same semantic scope" explanations. |
| `semantic_grounding_events` | `event_id`, `query`, `intent`, `candidate_json`, `plan_json`, `outcome`, `created_at` | Audit trail for resolver/planner decisions. |
| `semantic_feedback_proposals` | `proposal_id`, `kind`, `term`, `payload_json`, `status`, `evidence_json`, `created_at`, `updated_at` | Proposals for alias add, entry add, axis promotion, version transition. No automatic promotion. |

Indexes:

- `semantic_terms(canonical_label)`, `semantic_terms(prefix_id, version_id, address)`, `semantic_terms(doc_id)`
- `semantic_aliases(alias)`, `semantic_aliases(term_id)`
- `semantic_relations(source_term_id)`, `semantic_relations(target_term_id)`
- `semantic_feedback_proposals(status, kind)`

## Search Flow

`DocsService.list({ q })` currently delegates directly to `SearchService`. Phase 1 changes the internal flow while preserving the API shape.

```txt
q
  -> SemanticResolver.resolve(q)
  -> GroundingPlanner.plan("document-search", candidates)
  -> SearchService.search(scoped query or original q)
  -> merge/rerank with semantic evidence
  -> record grounding event
  -> if no confident candidate, create/update unresolved proposal
```

Fallback rules:

- If no candidate reaches the confidence threshold, run the existing FTS/LIKE flow unchanged and record an unresolved proposal.
- If candidates exist but produce no scoped hits, run existing FTS/LIKE and record a `wrong-scope-or-alias-missing` signal.
- If scoped hits and raw FTS hits disagree, return stable search results first and store the disagreement as feedback, not an exception.

## Candidate Ranking

Use a deterministic score in phase 1:

| Signal | Weight intent |
|---|---|
| exact canonical label match | strongest |
| exact alias match | strong |
| normalized token overlap | medium |
| document title/doc id match | medium |
| relation-neighbor evidence | weak booster |
| stale/inactive proposal status | penalty |

The resolver returns multiple candidates when ambiguous. The planner must not collapse ambiguity too early; it should preserve enough evidence to explain why a result matched.

## Materialization Inputs

Phase 1 seeds semantic tables from existing definition docs and label projection data:

- `documents`: `docId`, `title`, `tagsJson`, `linksJson`, `svc`, `address`, `targetPrefix`, `sourcePath`, marker text.
- `document_links`: relation evidence between docs.
- `deterministic-label-registry`: label records, source refs, dependency labels, evidence refs.
- Catalog/address fields already present in docs are treated as coordinates, not generated IDs.

Later materializers can add event/schema/code rows without changing resolver output shape.

## Future Package Extraction

After the service slice passes real search tests, extract only stable contracts to a new package, likely `semantic-indexing` or `semantic-grounding`.

Candidate extraction surface:

- `SemanticCandidate`, `SemanticEvidence`, `SemanticResolution`, `GroundingPlan`
- `SemanticResolverPort`
- `GroundingPlannerPort`
- `FeedbackProposal` and `FeedbackProposalStore`
- `IndexMaterializerPort`

Keep SQLite store adapters either in `definition-service` or in a separate adapter package if a second consumer appears. Do not extract NestJS modules.

## Work Areas

Primary files to inspect and modify during implementation:

| Area | Files |
|---|---|
| Drizzle schema and migrations | `packages/definition-service/src/db/schema.ts`, `packages/definition-service/drizzle/*`, `packages/definition-service/drizzle.config.ts` |
| Current search surface | `packages/definition-service/src/modules/search/search.service.ts`, `packages/definition-service/src/modules/docs/docs.service.ts` |
| Current sync/materialization path | `packages/definition-service/src/core/sync-engine.ts`, `packages/definition-service/src/sync/scanner.ts`, `packages/definition-service/src/modules/sync/*` |
| Store conventions | `packages/definition-service/src/stores/*`, especially `doc-store.ts`, `intent-store.ts`, `memory-stores.ts` |
| Existing semantic label source | `packages/deterministic-label-registry/src/*` |
| Coordinate catalog contracts | `packages/core/src/catalog/*`, `packages/index-meta/src/*` |
| Existing index packages to avoid duplicating | `packages/address-index/src/*`, `packages/tag-search/src/*` |

Existing unrelated worktree changes must be preserved. If package metadata changes are needed later, stage only the semantic grounding files and avoid sweeping current root-level WIP into the implementation commit.

## Tests and Verification

Phase 1 tests should stay focused:

- Unit tests for query normalization and resolver ranking.
- Store tests for insert/upsert, duplicate alias handling, coordinate lookup, and feedback proposal status transitions.
- Planner tests for candidate/no-candidate/fallback cases.
- `DocsService` or `SearchService` integration test proving `q` still returns legacy FTS results when semantic grounding has no match.
- A seeded test proving an alias such as `"상품 담기"` can ground to a canonical label and still explain the matched doc/address scope.

Closeout gates:

```bash
pnpm --filter @qa-sdk/definition-service test
pnpm --filter @qa-sdk/definition-service typecheck
pnpm arch:feedback
```

If schema or package dependency changes are made, also run the relevant migration generation/check command and inspect `git diff --check`.

## Risks

- `definition-service` can become a semantic monolith if package extraction is delayed too long. Mitigation: keep pure contracts in separate files from NestJS module wiring.
- Alias matching can over-constrain search. Mitigation: use semantic results to rank/scope, not to suppress fallback results.
- Feedback proposals can become noisy. Mitigation: dedupe unresolved terms and track outcome counts before creating promotion candidates.
- Vector and text-to-SQL targets may pull the contract in different directions. Mitigation: keep planner output typed by `intent` and avoid a single generic score function.

## Acceptance Criteria

- Existing document search API keeps working without semantic seed data.
- SQLite semantic tables can store canonical terms, aliases, relation evidence, grounding events, and proposals.
- A query can resolve to multiple semantic candidates with confidence and evidence.
- Search planning can use candidates to guide FTS while preserving legacy fallback.
- Unresolved or mismatched searches create proposal records rather than mutating the catalog.
- The remaining A-package extraction surface is explicit and small.
