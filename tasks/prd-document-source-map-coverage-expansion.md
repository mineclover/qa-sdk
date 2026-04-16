[PRD]
# PRD: Document Source Map Coverage Expansion

## Overview

The docs coordinate graph can now resolve source paths as graph nodes and avoids falling back to full-repository collection when coverage is missing. The next step is to expand explicit source-map coverage for the docs control plane, ontology CLI split modules, and ontology pack sources so bottom-up source traversal and `qa-sdk def find-by-file` become useful operational tools instead of mostly reporting `source-map-missing`.

This PRD improves source-map coverage through conservative frontmatter `sources:` / `source:` updates and targeted fixtures. It does not add REST, remote indexing, automatic source annotation, or broad source-map rewriting.

## Goals

- Add explicit source references for docs-control-plane implementation files.
- Add explicit source references for ontology CLI split modules and related ontology docs.
- Add explicit source references for operational/authorization pack implementation files.
- Make selected `qa-sdk docs graph <source-path> --axis source --direction in` queries return relevant docs instead of `source-map-missing`.
- Improve `qa-sdk def find-by-file` coverage where existing definition-catalog source-map conventions can support it.
- Record remaining source-map gaps in TODOs rather than hiding them through broad graph fallback.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs graph/source traversal regression
- `pnpm --filter @qa-sdk/cli test -- def` - definition CLI source-map regression
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter definition-catalog test` - definition-catalog source/reference regression
- `pnpm --filter definition-catalog typecheck` - definition-catalog type checking
- `node packages/cli/dist/index.js def validate` - repository definition validation

No browser verification is required.

## User Stories

### US-001: Define Source Map Coverage Targets

**Description:** As a docs control-plane maintainer, I want source-map coverage targets listed before editing docs so coverage expansion is deliberate and scoped.

**Acceptance Criteria:**
- [ ] Create a source-map coverage target list in this PRD or an adjacent note.
- [ ] Include docs-control-plane source files such as `docs.ts`, `graph-index.ts`, `graph-normalize.ts`, `graph-traverse.ts`, `graph-presets.ts`, `prd-to-ralph-json.ts`, and adapters.
- [ ] Include ontology CLI split modules such as `activation.ts`, `artifact-registry.ts`, `prompt-extract-artifact.ts`, `quality-status-evidence.ts`, `quality-ledger-evidence.ts`, `ingest.ts`, `status.ts`, and `navigation-diff.ts`.
- [ ] Include pack implementation sources such as `pack-core.ts`, `programming-artifact-core.ts`, and `authorization-ontology/src/index.ts`.
- [ ] Classify each target as `frontmatter-source`, `def-code-reference`, or `gap`.
- [ ] Do not modify source code comments in this story.

#### Source-map coverage target list

This list is the US-001 scoping artifact. It does not apply source-map edits by itself.

Classification:

- `frontmatter-source`: add or keep a definition markdown top-level `source:` / `sources:` entry. This is the preferred path for this PRD because it can feed docs graph coverage and, after `def sync`, DB-owned `code_references`.
- `def-code-reference`: reserve for future minimal `@def.doc` / `@def.boundary` annotations when file-level frontmatter is too broad or a symbol-level owner is required. No source comments are changed in US-001.
- `gap`: keep missing coverage explicit until an authoritative owning doc exists. Do not hide it through broad fallback or unrelated frontmatter.

Docs control-plane targets:

| source path | owning doc/family | classification | scope note |
|-------------|-------------------|----------------|------------|
| `packages/cli/src/commands/docs.ts` | `docs-control-plane` | `frontmatter-source` | Public docs command handler. |
| `packages/cli/src/command-groups/docs.commands.ts` | `docs-control-plane` | `frontmatter-source` | Public docs command descriptors. |
| `packages/cli/src/lib/docs-control-plane/types.ts` | `docs-control-plane` | `frontmatter-source` | Neutral envelope/read-model contracts. |
| `packages/cli/src/lib/docs-control-plane/normalize.ts` | `docs-control-plane` | `frontmatter-source` | Envelope normalization helpers. |
| `packages/cli/src/lib/docs-control-plane/query.ts` | `docs-control-plane` | `frontmatter-source` | Status/search/collection query helpers. |
| `packages/cli/src/lib/docs-control-plane/drift.ts` | `docs-control-plane` | `frontmatter-source` | PRD/session drift calculation. |
| `packages/cli/src/lib/docs-control-plane/metadata-transform.ts` | `docs-control-plane` | `frontmatter-source` | Dry-run metadata transform surface. |
| `packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts` | `docs-control-plane` | `frontmatter-source` | PRD completion candidate analysis. |
| `packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts` | `docs-control-plane` | `frontmatter-source` | Ralph-compatible PRD JSON conversion. |
| `packages/cli/src/lib/docs-control-plane/graph-types.ts` | `docs-control-plane` | `frontmatter-source` | Graph taxonomy and axis contracts. |
| `packages/cli/src/lib/docs-control-plane/graph-index.ts` | `docs-control-plane` | `frontmatter-source` | Source/evidence/role graph indexing. |
| `packages/cli/src/lib/docs-control-plane/graph-normalize.ts` | `docs-control-plane` | `frontmatter-source` | Authored relation to canonical axis normalization. |
| `packages/cli/src/lib/docs-control-plane/graph-traverse.ts` | `docs-control-plane` | `frontmatter-source` | Traversal execution and bounded diagnostics. |
| `packages/cli/src/lib/docs-control-plane/graph-presets.ts` | `docs-control-plane` | `frontmatter-source` | Preset expansion for graph views. |
| `packages/cli/src/lib/docs-control-plane/graph-scope.ts` | `docs-control-plane` | `frontmatter-source` | Scope and repository path handling. |
| `packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts` | `docs-control-plane` | `frontmatter-source` | Definition markdown adapter. |
| `packages/cli/src/lib/docs-control-plane/adapters/prd-markdown.ts` | `docs-control-plane` | `frontmatter-source` | PRD markdown adapter. |
| `packages/cli/src/lib/docs-control-plane/adapters/ralph-prd-json.ts` | `docs-control-plane` | `frontmatter-source` | Ralph PRD JSON adapter. |
| `packages/cli/src/lib/docs-control-plane/adapters/ralph-session.ts` | `docs-control-plane` | `frontmatter-source` | Ralph session adapter. |
| `packages/cli/src/lib/docs-control-plane/adapters/artifact-evidence.ts` | `docs-control-plane` | `frontmatter-source` | Artifact evidence adapter. |
| `packages/cli/src/lib/docs-control-plane/index.ts` | `docs-control-plane` | `gap` | Barrel-only facade; cover behavior through constituent modules unless a facade-level lookup becomes required. |

Ontology CLI split-module targets:

| source path | owning doc/family | classification | scope note |
|-------------|-------------------|----------------|------------|
| `packages/cli/src/commands/ontology/activation.ts` | `operational-ontology-registry-activation-*` and `programming-artifact-ontology-activation-evidence` | `frontmatter-source` | Activation command orchestration and activation evidence production. |
| `packages/cli/src/commands/ontology/artifact-registry.ts` | `programming-artifact-ontology-registry-provider` and activation evidence docs | `frontmatter-source` | Registry validate/list/append behavior. |
| `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` | `programming-artifact-ontology-*` provider/quality/evidence docs | `frontmatter-source` | Artifact source lookup, fallback JSON, and provider merge. |
| `packages/cli/src/commands/ontology/quality-status-evidence.ts` | `programming-artifact-ontology-quality-evidence` | `frontmatter-source` | Quality-status record and snapshot evidence. |
| `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` | `programming-artifact-ontology-quality-evidence` | `frontmatter-source` | Ledger fallback, freshness, and governance closure evidence. |
| `packages/cli/src/commands/ontology/ingest.ts` | ontology CLI docs | `gap` | No authoritative owning doc identified yet; keep source-map miss explicit until ownership is documented. |
| `packages/cli/src/commands/ontology/status.ts` | ontology CLI docs | `gap` | No authoritative owning doc identified yet; keep source-map miss explicit until ownership is documented. |
| `packages/cli/src/commands/ontology/navigation-diff.ts` | ontology CLI docs | `gap` | No authoritative owning doc identified yet; keep source-map miss explicit until ownership is documented. |
| `packages/cli/src/commands/ontology/support.ts` | ontology CLI support helpers | `def-code-reference` | Shared helper module; prefer future symbol-level references only if a specific helper becomes an owned boundary. |

Pack implementation targets:

| source path | owning doc/family | classification | scope note |
|-------------|-------------------|----------------|------------|
| `packages/operational-ontology/src/internal/pack-core.ts` | `operational-ontology-pack-interface` | `frontmatter-source` | Core pack interface implementation. |
| `packages/operational-ontology/src/pack.ts` | `operational-ontology-pack-interface` | `frontmatter-source` | Public pack facade, if US-004 keeps it in scope. |
| `packages/operational-ontology/src/internal/programming-artifact-core.ts` | `programming-artifact-ontology-system` and provider/evidence leaves | `frontmatter-source` | Programming artifact pack implementation. |
| `packages/operational-ontology/src/programming-artifacts.ts` | `programming-artifact-ontology-system` and provider/evidence leaves | `frontmatter-source` | Public programming artifact facade, if US-004 keeps it in scope. |
| `packages/authorization-ontology/src/index.ts` | `authorization-ontology-package-architecture` | `frontmatter-source` | Authorization ontology public pack implementation. |

### US-002: Add Docs Control Plane Source References

**Description:** As a docs operator, I want docs-control-plane specs to point at the actual control-plane implementation files so graph source traversal works for the docs command family.

**Acceptance Criteria:**
- [ ] Update `docs/specs/definition-catalog/docs-control-plane.spec.md` with source references for docs command and graph implementation files.
- [ ] Include source refs for graph type/index/normalize/traverse/preset modules.
- [ ] Include source refs for docs command and command-group files.
- [ ] Keep references conservative and avoid listing unrelated CLI files.
- [ ] `qa-sdk docs graph packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts --axis source --direction in --json` returns at least `docs-control-plane`.
- [ ] `qa-sdk docs status docs-control-plane --json` remains narrow and diagnostic-free.

### US-003: Add Ontology CLI Split Module Source References

**Description:** As an ontology maintainer, I want split ontology CLI docs to reference their extracted modules so source traversal reaches the correct activation, registry, prompt, quality, ingest, and navigation boundaries.

**Acceptance Criteria:**
- [ ] Ensure registry activation docs reference `packages/cli/src/commands/ontology/activation.ts`.
- [ ] Ensure activation evidence docs reference `activation.ts`, `artifact-registry.ts`, and `prompt-extract-artifact.ts` where applicable.
- [ ] Ensure programming artifact registry provider docs reference `artifact-registry.ts` and `prompt-extract-artifact.ts`.
- [ ] Ensure quality evidence docs reference `quality-status-evidence.ts` and `quality-ledger-evidence.ts`.
- [ ] Ensure CLI docs reference prompt extraction and support modules only where they own behavior.
- [ ] `qa-sdk docs graph packages/cli/src/commands/ontology/activation.ts --axis source --direction in --json` returns activation docs and no full-repository fallback.
- [ ] `qa-sdk docs graph packages/cli/src/commands/ontology/quality-ledger-evidence.ts --axis source --direction in --json` returns quality evidence docs or a documented source-map gap.

### US-004: Add Pack Implementation Source References

**Description:** As an ontology pack author, I want pack implementation docs to reference pack source files so source traversal can connect pack code to pack schema and validation docs.

**Acceptance Criteria:**
- [ ] Ensure `operational-ontology-pack-interface` references `packages/operational-ontology/src/internal/pack-core.ts` and the public pack facade where appropriate.
- [ ] Ensure `programming-artifact-ontology-system` and provider/evidence leaves reference `programming-artifact-core.ts` and public exports where appropriate.
- [ ] Ensure `authorization-ontology-system` or package architecture docs reference `packages/authorization-ontology/src/index.ts`.
- [ ] Avoid duplicating the same source path across unrelated docs unless each doc owns distinct behavior.
- [ ] `qa-sdk docs graph packages/operational-ontology/src/internal/pack-core.ts --axis source --direction in --json` returns pack interface docs.
- [ ] `qa-sdk docs graph packages/authorization-ontology/src/index.ts --axis source --direction in --json` returns authorization ontology docs.

### US-005: Add Source Map Coverage Tests

**Description:** As a CLI maintainer, I want regression tests proving selected source paths resolve to targeted documents so future refactors do not break bottom-up traversal.

**Acceptance Criteria:**
- [ ] Add CLI or docs-control-plane tests for docs-control-plane source path traversal.
- [ ] Add tests for ontology activation source path traversal.
- [ ] Add tests for pack-core source path traversal.
- [ ] Add tests for a missing source-map path returning bounded `source-map-missing` diagnostics.
- [ ] Tests assert source path traversal does not return full-repository status or collect results.
- [ ] Existing docs graph tests remain green.

### US-006: Improve `def find-by-file` Coverage Where Appropriate

**Description:** As a definition-catalog user, I want explicit source-map coverage to improve `qa-sdk def find-by-file` where definition-catalog conventions can authoritatively map code to docs.

**Acceptance Criteria:**
- [ ] Identify which new or existing frontmatter `source:` entries are compatible with `def sync` / `find-by-file`.
- [ ] Run `qa-sdk def find-by-file` for at least one docs-control-plane implementation file after sync or scan-equivalent setup if supported.
- [ ] Run `qa-sdk def find-by-file` for at least one ontology CLI split module after sync or scan-equivalent setup if supported.
- [ ] If `def find-by-file` cannot be improved without code annotations, record the gap in docs-control-plane TODO instead of adding broad mappings.
- [ ] Do not change `def find-by-file` implementation in this PRD.

### US-007: Update Docs Control Plane TODO And Plan

**Description:** As a documentation maintainer, I want the roadmap and TODOs to reflect completed source-map coverage work and remaining gaps.

**Acceptance Criteria:**
- [ ] Update `docs/specs/definition-catalog/docs-control-plane.todo.md` to close completed source-map coverage targets.
- [ ] Keep remaining source-map gaps open and scoped.
- [ ] Update `docs/specs/definition-catalog/docs-control-plane.plan.md` only if priority order changes.
- [ ] Do not move pack authoring, graph ranking/filtering, PRD sync precision, or section-level graph work into this PRD.

### US-008: Verify Source Map Coverage Operationally

**Description:** As a reviewer, I want operational CLI proof that selected source paths now resolve through docs graph and that remaining gaps are explicit.

**Acceptance Criteria:**
- [x] Run `qa-sdk docs graph packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts --axis source --direction in --json`.
- [x] Run `qa-sdk docs graph packages/cli/src/commands/ontology/activation.ts --axis source --direction in --json`.
- [x] Run `qa-sdk docs graph packages/operational-ontology/src/internal/pack-core.ts --axis source --direction in --json`.
- [x] Run at least one missing-source-path graph query and confirm it returns bounded `source-map-missing`.
- [x] Run `qa-sdk docs drift --prd tasks/prd-document-source-map-coverage-expansion.json --json` after completion.
- [x] Record residual coverage gaps in the TODO document.

## Functional Requirements

- FR-1: Source-map expansion must use existing source conventions, not broad topic matching.
- FR-2: Source path graph traversal must not fall back to full-repository collection.
- FR-3: Source references must be conservative and owned by the relevant doc family.
- FR-4: `qa-sdk def find-by-file` behavior must not change.
- FR-5: Missing coverage must remain visible as explicit TODO or `source-map-missing` output.

## Non-Goals

- Adding a remote source-map service.
- Rewriting all repository docs with source refs.
- Adding bulk `@def.doc` annotations.
- Changing `qa-sdk def find-by-file` implementation.
- Adding ontology pack authoring commands.
- Adding graph ranking/filtering features.
- Adding section-level graph traversal.

## Technical Considerations

- Relevant docs:
  - `docs/specs/definition-catalog/docs-control-plane.spec.md`
  - `docs/specs/definition-catalog/docs-control-plane.todo.md`
  - `docs/specs/definition-catalog/docs-control-plane.plan.md`
  - ontology registry activation/evidence/result docs
  - programming artifact registry provider/quality evidence docs
  - ontology pack interface and authorization ontology package docs
- Relevant code:
  - `packages/cli/src/lib/docs-control-plane/*.ts`
  - `packages/cli/src/lib/docs-control-plane/adapters/*.ts`
  - `packages/cli/src/commands/docs.ts`
  - `packages/cli/src/commands/ontology/*.ts`
  - `packages/operational-ontology/src/internal/pack-core.ts`
  - `packages/operational-ontology/src/internal/programming-artifact-core.ts`
  - `packages/authorization-ontology/src/index.ts`

## Success Metrics

- Selected docs-control-plane source paths resolve to docs via `docs graph --axis source --direction in`.
- Selected ontology CLI split module paths resolve to docs via `docs graph --axis source --direction in`.
- Selected pack implementation paths resolve to pack docs via `docs graph --axis source --direction in`.
- Missing coverage remains explicit and bounded.
- docs-control-plane TODO reflects completed coverage and remaining gaps.

## Open Questions

- Should `def sync` be part of the required verification for source-map coverage, or should this PRD stop at docs-control-plane graph coverage and leave synced DB coverage as follow-up?
[/PRD]
