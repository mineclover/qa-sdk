# PRD: Doc Envelope Package Extraction (C-1)

## Overview

Extract the `DocumentEnvelope` type model and its pure utility functions from `@qa-sdk/cli`'s `docs-control-plane` internal module into a standalone unscoped library package `doc-envelope`. This is the **first of three stages (C-1 → C-2 → C-3)** in the deterministic-label-registry extraction plan, enabling later extraction of `ontology-pack-validate` and `deterministic-label-registry` packages as libraries that depend on `doc-envelope`.

The work is a mechanical move with zero behavior change. No new features. No renamed APIs. All existing consumers (cli commands, tests) continue to work via updated import paths.

## Why

Currently `DocumentEnvelope` types and pure envelope utilities live inside `@qa-sdk/cli` (a platform service). The CLAUDE.md rule "QA 플랫폼 → 인코딩 라이브러리만 허용 (역방향 금지)" forbids future library packages from depending on `@qa-sdk/cli`. So a shared library needs to be introduced before `deterministic-label-registry` can be extracted.

Extracting `doc-envelope` also clarifies the collection/interpretation layer boundary declared in `doc-frontmatter-namespace.spec.md` and `doc-metadata-layering-survey.memo.md` — envelope types + pure utilities belong to the shared "collection/data-model" layer; interpretations (graph ranking, FSM readiness, drift detection) stay in cli.

## Scope

### In scope (C-1)

- Create `packages/doc-envelope/` as unscoped library (tsup dual format per CLAUDE.md convention)
- Move 5 source files + 2 test files from `packages/cli/src/lib/docs-control-plane/` to `packages/doc-envelope/src/`:
  - `types.ts`, `normalize.ts`, `query.ts` (envelope model + factory + query filter)
  - `family-scope.ts` + `family-scope.test.ts` (archive/session scope detection)
  - `completed-records.ts` + `completed-records.test.ts` (completed record detection)
- Create `packages/doc-envelope/src/index.ts` barrel exposing public API
- Update `@qa-sdk/cli` to depend on `doc-envelope` and switch all internal imports
- Keep existing import paths in `docs-control-plane/index.ts` by re-exporting from `doc-envelope` (backward-compatible barrel)

### Out of scope (C-1)

- C-2 `ontology-pack-validate` extraction — separate PRD
- C-3 `deterministic-label-registry` extraction — separate PRD
- Any renames of exported symbols
- Any behavior changes (types, normalization, scope detection, completed-record logic remain identical)
- Moving higher-level modules (graph-*, role-matrix, follow-ups, drift) — these are interpretation, stay in cli
- Any change to JSON output surface of `docs status` / `docs collect` / `docs graph`

## Goals

- Establish `packages/doc-envelope/` as a stable unscoped library with public API identical to the current `docs-control-plane` re-exports for envelope-related symbols
- Preserve all existing `@qa-sdk/cli` behavior — not a single test assertion should change
- Reduce `docs-control-plane` internal surface so later extractions (C-2, C-3) are mechanical

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter doc-envelope build` — new package build (where applicable)
- `pnpm --filter doc-envelope test` — new package tests (where applicable)
- `pnpm --filter @qa-sdk/cli typecheck` — CLI type checking
- `pnpm --filter @qa-sdk/cli test -- docs` — docs control-plane tests
- `pnpm --filter @qa-sdk/cli build` — CLI bundle validation
- `node packages/cli/dist/index.js def validate` — definition graph validation
- `node packages/cli/dist/index.js docs status docs-control-plane --json` — operational smoke check
- `node packages/cli/dist/index.js docs status deterministic-label-registry-fsm-plan --json` — related doc status

## User Stories

### US-001: Create doc-envelope package scaffolding

**Description:** As a platform maintainer, I want a new `doc-envelope` package directory with the repo's standard library build configuration so that source files can be moved in without build errors.

**Acceptance Criteria:**
- `packages/doc-envelope/package.json` exists with `name: "doc-envelope"` (unscoped), `type: "module"`, tsup dual format config (ESM + CJS), peerDependencies on `typescript`
- `packages/doc-envelope/tsup.config.ts` mirrors repo's library convention (ES2023 target, d.ts output, dual format)
- `packages/doc-envelope/tsconfig.json` extends root or matches existing library tsconfig pattern
- `packages/doc-envelope/src/` directory created (empty for now)
- `pnpm install` completes without error
- Package appears in workspace listings (`pnpm list --depth -1`)

### US-002: Move envelope type model, normalizer, and query filter

**Description:** As a library maintainer, I want `types.ts`, `normalize.ts`, and `query.ts` moved from `docs-control-plane` to `doc-envelope` so envelope data model lives in the shared library.

**Acceptance Criteria:**
- `packages/doc-envelope/src/types.ts` contains the full contents of the original `packages/cli/src/lib/docs-control-plane/types.ts`
- `packages/doc-envelope/src/normalize.ts` contains the full contents of the original `packages/cli/src/lib/docs-control-plane/normalize.ts` with internal import path adjusted (`./types.js` still works within new package)
- `packages/doc-envelope/src/query.ts` contains the full contents of the original, with `./types.js` import adjusted
- Original files at `packages/cli/src/lib/docs-control-plane/types.ts|normalize.ts|query.ts` are removed (git mv)
- `packages/doc-envelope/src/index.ts` exports all public symbols from these three files
- All imports of these modules inside `packages/cli/` are updated to import from `doc-envelope` instead of relative paths

### US-003: Move envelope scope utilities (family-scope + completed-records)

**Description:** As a library maintainer, I want `family-scope.ts` and `completed-records.ts` moved to `doc-envelope` together with their tests, so pure envelope-scope utilities live alongside the envelope model.

**Acceptance Criteria:**
- `packages/doc-envelope/src/family-scope.ts` contains the full contents of the original with import paths adjusted
- `packages/doc-envelope/src/family-scope.test.ts` moved and passing
- `packages/doc-envelope/src/completed-records.ts` moved with imports adjusted
- `packages/doc-envelope/src/completed-records.test.ts` moved and passing
- Original files at `packages/cli/src/lib/docs-control-plane/family-scope.ts|completed-records.ts|*.test.ts` are removed
- Public exports added to `packages/doc-envelope/src/index.ts`
- `pnpm --filter doc-envelope test` passes for these 2 moved test files

### US-004: Define doc-envelope public barrel (index.ts)

**Description:** As a consumer, I want `doc-envelope`'s public API defined in its `src/index.ts` so I can import from the package name without reaching into internal paths.

**Acceptance Criteria:**
- `packages/doc-envelope/src/index.ts` exports all previously-exposed symbols currently re-exported via `packages/cli/src/lib/docs-control-plane/index.ts` from the 5 moved files
- Exports include (non-exhaustive): `DocumentEnvelope`, `DocumentMetadata`, `DocumentLink`, `DocumentSource`, `DocumentTask`, `DocumentEnvelopeInput`, `DocumentAdapter`, `DocumentAdapterCapabilities`, `DocumentAdapterCapabilityDeclaration`, `DocumentDiagnostic`, `DocumentEvidence`, `DocumentSection`, `DocumentCollectionQuery`, `DocumentChange`, `DocumentChangeSet`, `DocumentRawSourcePointer`
- Functions: `normalizeDocumentEnvelope`, `defineDocumentAdapter`, `declareDocumentAdapterCapabilities`, `matchesDocumentQuery`, `collectDocumentFamilyOnlyScope`, `isArchivedPrdDocument`, `isTransientSessionDocument`, `detectCompletedRecords`
- Types: `DocumentFamilyOnlyScope`, `DocumentFamilyOnlyScopeOptions`, `CompletedRecordState`, `CompletedRecordDetectionOptions`
- No internal helpers leaked
- `pnpm --filter doc-envelope build` produces dist files with the declared public API

### US-005: Add doc-envelope dependency to @qa-sdk/cli and switch imports

**Description:** As a cli maintainer, I want `@qa-sdk/cli` to depend on `doc-envelope` and all internal import paths switched so behavior is preserved through the new package boundary.

**Acceptance Criteria:**
- `packages/cli/package.json` adds `"doc-envelope": "workspace:*"` in dependencies
- Every file in `packages/cli/src/` that previously imported from `./types.js` / `./normalize.js` / `./query.js` / `./family-scope.js` / `./completed-records.js` (relative paths inside `docs-control-plane`) now imports from `doc-envelope`
- `packages/cli/src/lib/docs-control-plane/index.ts` re-exports the same symbols from `doc-envelope` instead of from local files (barrel compat layer)
- No file inside `docs-control-plane/` directly references a moved file path after this story
- ~48 DocumentEnvelope-touching files across `packages/cli/src/` compile without error
- `pnpm --filter @qa-sdk/cli typecheck` passes

### US-006: Verify doc-envelope extraction operationally

**Description:** As a reviewer, I want command evidence that the extraction preserves behavior without regression.

**Acceptance Criteria:**
- `pnpm --filter @qa-sdk/cli test -- docs` all 160+ tests pass (no delta from pre-extraction baseline)
- `pnpm --filter @qa-sdk/cli typecheck` clean
- `pnpm --filter @qa-sdk/cli build` produces valid bundle
- `node packages/cli/dist/index.js def validate` → 경고 0건
- `node packages/cli/dist/index.js docs status docs-control-plane --json` returns the same shape as before
- `node packages/cli/dist/index.js docs status deterministic-label-registry-fsm-plan --json` returns the same shape as before
- `docs/specs/definition-catalog/doc-metadata-field-ownership.rule.md` still accurate (no field ownership change)
- Git diff shows only mechanical moves + import path updates; no logic changes

## Functional Requirements

- FR-1: `doc-envelope` must be an unscoped library package per CLAUDE.md's "새 라이브러리 → unscoped name + tsup dual format" rule
- FR-2: Public API of `doc-envelope` must be a superset of the envelope-related re-exports currently in `docs-control-plane/index.ts`, preserving all symbol names and type signatures
- FR-3: `docs-control-plane/index.ts` must continue to re-export envelope symbols so existing external consumers of cli internals keep working (backward-compatible barrel)
- FR-4: No behavior change — all tests pass without modification to their assertions
- FR-5: `doc-envelope` must not depend on `@qa-sdk/cli` or any platform service (unscoped library rule)
- FR-6: `doc-envelope` must be dependable by future unscoped libraries (`ontology-pack-validate`, `deterministic-label-registry`)

## Non-Goals

- No new types or functions in `doc-envelope`
- No renaming of existing types or functions
- No changes to envelope JSON shape or command output
- No migration of higher-level docs-control-plane modules (graph-*, role-matrix, follow-ups, drift, adapters)
- No C-2 or C-3 work
- No changes to definition-catalog package

## Technical Considerations

- `normalize.ts` only imports from `./types.js` — self-contained, moves cleanly
- `query.ts` only imports from `./types.js` — self-contained
- `family-scope.ts` imports from `./types.js` only
- `completed-records.ts` imports from `./types.js` only
- None of the 5 moved files import from other docs-control-plane internals — dependency boundary is clean
- Barrel-compat layer in `docs-control-plane/index.ts` prevents mass rewrite of external consumers that import via `docs-control-plane`

## Success Metrics

- 0 test failures introduced
- 0 typecheck errors introduced
- 0 `def validate` warnings introduced
- All moved files accounted for (no stranded imports)
- Future C-2 PRD can start with `ontology-pack-validate` package creation against `doc-envelope` without further restructuring

## Open Questions

- Should `doc-envelope` include a minimal README.md stating its role as the collection-layer data model? (Recommended — yes, mirror the one-liner purpose statement from this PRD)
- Should `doc-envelope` expose a JSON schema for `DocumentEnvelope` for future cross-language consumers? (Out of scope for C-1; revisit after stability work)
