[PRD]
# PRD: Docs And Ontology Pack Reuse Refactor

## Overview

This PRD refactors the recently added docs lifecycle and ontology pack authoring features to improve reuse, maintainability, and future extension safety without changing behavior. The current implementation works and passes tests, but core command files and generator modules have grown large: `packages/cli/src/commands/docs.ts` owns status, collect, PRD context, follow-up parsing, completed record detection, role coverage, printing, and command dispatch; `packages/cli/src/commands/ontology.ts` owns prompt extraction, artifact registry, pack scaffold, pack validate, and activation dispatch; `ontology-pack-scaffold-plan.ts` combines plan derivation, CLI parsing, diagnostics, path policy, docs rendering, TypeScript rendering, and test rendering.

The refactor will split reusable domain logic into smaller internal CLI libraries while preserving the current command behavior. It should apply the architecture-neutral identity/data/system separation principle where useful: identity/read-model data lives in small data-oriented modules, and transformation/system logic lives in explicit parser, renderer, readiness, or command-handler modules. This is not a feature PRD and should not change external behavior except for equivalent command help/import paths if needed.

Docs lifecycle extraction and ontology pack extraction should remain reviewable as separate commit groups where practical.

## Goals

- Reduce the responsibility and size of `docs.ts` and `ontology.ts`.
- Extract docs lifecycle reusable logic from command-layer code.
- Extract ontology pack scaffold rendering from scaffold plan derivation.
- Extract ontology pack validate loader/readiness logic into focused modules.
- Establish a repeatable CLI convention: command files dispatch and print; lib modules own business logic.
- Preserve current JSON/text command behavior.
- Preserve existing tests and add focused regression tests around extracted modules.
- Keep future features such as `docs lifecycle inventory`, `pack validate --strict`, and pack authoring extensions easier to add.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and CLI regression tests
- `pnpm --filter @qa-sdk/cli test -- ontology` - ontology CLI and pack authoring regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter operational-ontology test -- pack` - operational ontology pack validation regression
- `node packages/cli/dist/index.js def validate` - definition graph and source-map validation

Operational checks:

- `node packages/cli/dist/index.js docs status docs-control-plane --json`
- `node packages/cli/dist/index.js docs status programming-artifact-ontology-system --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-topdown-lifecycle-inventory-alignment.json --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-ontology-pack-authoring-control-plane.json --json`
- `node packages/cli/dist/index.js ontology pack scaffold sample-domain-ontology --json`
- `node packages/cli/dist/index.js ontology pack validate programming-artifact-ontology --json`

No browser verification is required.

## User Stories

### US-001: Define Refactor Boundaries And No-Behavior-Change Contract

**Description:** As a maintainer, I want the refactor boundaries documented before moving code so that agents preserve behavior while improving structure.

**Acceptance Criteria:**
- [x] Document the refactor boundary in a PRD note or implementation note.
- [x] Identify modules to extract from `docs.ts`: TODO lifecycle parser, completed records, follow-up ranking, role matrix, family-only scope usage, and status read-model assembly.
- [x] Identify modules to extract from `ontology.ts`: pack scaffold command handler and pack validate command handler.
- [x] Identify modules to split from `ontology-pack-scaffold-plan.ts`: plan, paths, diagnostics, docs renderers, code renderers, test renderers, known-pack candidate.
- [x] Identify modules to split from `ontology-pack-validate.ts`: loader, runtime validation, file readiness, docs/source-map readiness, summary.
- [x] State that JSON shape must remain backward-compatible; object field order is not a compatibility requirement.
- [x] State that text output should preserve important wording and command meaning, but exact line ordering is not a compatibility requirement.
- [x] State that docs lifecycle extraction and ontology pack extraction should be reviewable as separate commit groups where practical.
- [x] Do not move code in this story.

#### US-001 Implementation Note: Refactor Boundary And Compatibility Contract

US-001 is a documentation-only story. It records the extraction boundary before later stories move code. No command source, library source, import path, runtime behavior, JSON schema, text output, tests, or generated artifacts are intentionally changed in this story.

Future docs lifecycle extraction should make `packages/cli/src/commands/docs.ts` a command assembly and output-formatting surface while moving reusable read-model logic under `packages/cli/src/lib/docs-control-plane/`:

- `todo-lifecycle.ts`: TODO heading/category/hierarchy parsing, including `parseTodoFollowUps`, `classifyTodoHeading`, checkbox hierarchy helpers, TODO category labels, heading path, parent title, pointer, and depth handling.
- `completed-records.ts`: completed TODO and PRD record detection, including checked-only `.todo.md` detection, paired PRD markdown and ralph PRD JSON completion detection, archive/transient exclusion, checkbox counting, and completed-record ordering.
- `follow-ups.ts`: session follow-up, task follow-up, TODO follow-up, completed-record exclusion, `findNextFollowUps`, `compareFollowUps`, and `followUpRank`.
- `role-matrix.ts`: role coverage and role matrix read-model assembly for same-family and linked-role coverage.
- `family-scope.ts`: family-only scope usage shared by `docs status`, `docs collect --family-only`, and `docs prd sync-completion --family-only`.
- `status-read-model.ts`: status read-model assembly around counts, resolved target state, scoped documents, completed records, follow-ups, role coverage, source maps, and diagnostics.

Future ontology command extraction should keep `packages/cli/src/commands/ontology.ts` responsible for top-level command routing, shared help text, shared error printing, prompt extraction, artifact registry, and activation dispatch. Pack authoring handlers should move into command-handler modules:

- `packages/cli/src/commands/ontology/pack-scaffold.ts`: parse and execute `ontology pack scaffold`, delegate plan creation and optional write mode, preserve dry-run/write/json semantics, and return/print the existing scaffold preview shape.
- `packages/cli/src/commands/ontology/pack-validate.ts`: parse and execute `ontology pack validate`, delegate validation, preserve known-pack and file-ref behavior, and return/print the existing validation shape.

Future scaffold planning extraction should split `packages/cli/src/lib/ontology-pack-scaffold-plan.ts` into focused internal modules while preserving the public behavior of `createOntologyPackScaffoldPlan()` and `createOntologyPackScaffoldPlanFromCliArgs()`:

- `ontology-pack-scaffold/plan.ts`: plan orchestration, identity derivation, source-map candidate assembly, output file list assembly, and stable result shape.
- `ontology-pack-scaffold/paths.ts`: safe repo path resolution, default docs/package/test paths, file-base/source-dir derivation, and display path helpers.
- `ontology-pack-scaffold/diagnostics.ts`: flag diagnostics, safe-id diagnostics, conflict diagnostics, and `hasOntologyPackScaffoldErrors`.
- `ontology-pack-scaffold/render-docs.ts`: `renderSpecDoc`, `renderTodoDoc`, `renderPlanDoc`, `renderRuleDoc`, `renderCasesDoc`, and `renderTestDoc`.
- `ontology-pack-scaffold/render-code.ts`: `renderComponentSchemaFile` and `renderSystemBindingFile`.
- `ontology-pack-scaffold/render-tests.ts`: `renderPackTestFile`.
- `ontology-pack-scaffold/known-pack-candidate.ts`: known-pack registration candidate construction, target path, import path, and export name calculation.

Future pack validation extraction should split `packages/cli/src/lib/ontology-pack-validate.ts` into focused internal modules while preserving the public behavior of `validateOntologyPackFromRef()`:

- `ontology-pack-validate/load-pack.ts`: known-pack resolution, file-path resolution, supported extension checks, dynamic import/JSON loading, payload extraction, and unresolved-pack errors.
- `ontology-pack-validate/runtime-validation.ts`: runtime `validateOperationalOntologyPack()` issue mapping and pack identity/component/system binding summaries that depend on runtime validation results.
- `ontology-pack-validate/file-readiness.ts`: blueprint and scaffold-metadata static file reference collection, file existence checks, duplicate ref handling, and missing-file readiness issues.
- `ontology-pack-validate/docs-readiness.ts`: definition doc matching, source-map matching, docs readiness, source-map readiness, and readiness warnings that must remain warnings.
- `ontology-pack-validate/summary.ts`: final validation result assembly, readiness summaries, identity summary, component schema summary, system binding summary, and issue ordering.

Compatibility contract:

- JSON output must remain backward-compatible in field names, nesting, value meaning, and required/optional field presence. Object field order is not a compatibility requirement.
- Text output should preserve important wording, command names, option meaning, diagnostics meaning, and operator guidance. Exact line ordering is not a compatibility requirement unless an existing test already asserts it.
- Docs lifecycle extraction and ontology pack extraction should be reviewable as separate commit groups where practical. Docs lifecycle work should avoid changing ontology pack internals, and ontology pack work should avoid changing docs lifecycle internals except where shared tests require coordination.
- Extracted modules are internal CLI libraries for this PRD. They should not become package-level public exports unless a later PRD explicitly promotes them.

### US-002: Extract Docs TODO Lifecycle Parser

**Description:** As a docs control-plane maintainer, I want TODO heading/category/hierarchy parsing extracted from `docs.ts` so it can be reused by status, inventory, drift, and future lifecycle commands.

**Acceptance Criteria:**
- [x] Create a focused docs-control-plane module for TODO lifecycle parsing.
- [x] Move canonical category labels and heading classification into the module.
- [x] Move checkbox hierarchy parsing into the module.
- [x] Preserve support for `Completed`, `Actionable`, `Deferred`, `Parking Lot`, Korean equivalents, and uncategorized headings.
- [x] Preserve `depth`, `parentTitle`, `headingPath`, `pointer`, and category output.
- [x] Add focused unit tests for parent/child TODO hierarchy and category inference.
- [x] Do not introduce a general Markdown AST parser in this story.
- [x] `docs status ... --json` output remains behaviorally equivalent.

### US-003: Extract Docs Completed Record Detection

**Description:** As a docs operator, I want completed record detection extracted from `docs.ts` so completed TODO/PRD record candidates can be reused by inventory and drift tools.

**Acceptance Criteria:**
- [x] Create a focused module for completed record detection.
- [x] Move `.todo.md` checked-only detection into the module.
- [x] Move paired PRD markdown/ralph PRD JSON completion detection into the module.
- [x] Preserve archive/transient exclusion behavior.
- [x] Preserve `completedRecords[]` JSON shape.
- [x] Add focused tests for completed TODO and completed PRD markdown detection.
- [x] `docs status ... --json` still returns the same completed record candidates.

### US-004: Extract Docs Follow-Up Candidate Ranking

**Description:** As a maintainer, I want next follow-up candidate construction and ranking extracted so future commands can reuse the same priority semantics.

**Acceptance Criteria:**
- [x] Create a focused module for follow-up candidate construction.
- [x] Move session follow-up, task follow-up, TODO follow-up, and completed-record exclusion logic into the module.
- [x] Move follow-up ranking into the module.
- [x] Preserve ordering: session, actionable, uncategorized, deferred, parking-lot.
- [x] Preserve `nextFollowUp` and `nextFollowUps` JSON behavior.
- [x] Add focused tests for ranking across categories.
- [x] Command-layer `docs.ts` only calls the extracted function.

### US-005: Extract Docs Role Matrix And Family Scope Read Models

**Description:** As a docs control-plane maintainer, I want role coverage and family-only scope logic reusable outside command assembly so future lifecycle inventory commands do not duplicate status behavior.

**Acceptance Criteria:**
- [x] Keep or move family-only scope logic into a focused reusable module if not already isolated.
- [x] Extract role matrix read-model assembly from command-layer code.
- [x] Preserve active archive/session exclusion defaults.
- [x] Preserve `roleCoverage` JSON shape.
- [x] Add focused tests for same-family role coverage and linked role coverage.
- [x] `docs status`, `docs collect --family-only`, and `docs prd sync-completion --family-only` continue to pass existing tests.

### US-006: Slim Docs Command Assembly

**Description:** As a CLI maintainer, I want `docs.ts` to become a command assembly surface that delegates lifecycle read-model work to library modules.

**Acceptance Criteria:**
- [x] `docs.ts` no longer defines TODO parsing internals such as `parseTodoFollowUps`, `classifyTodoHeading`, or checkbox hierarchy helpers.
- [x] `docs.ts` no longer defines completed record detection internals such as `findCompletedRecords` or checkbox counting for completed records.
- [x] `docs.ts` no longer defines follow-up ranking internals such as `findNextFollowUps`, `compareFollowUps`, or `followUpRank`.
- [x] `docs.ts` no longer defines role matrix construction internals.
- [x] `docs.ts` remains the command assembly and output formatting surface.
- [x] Text and JSON output remain equivalent.
- [x] Existing docs command tests pass without changing command behavior.

### US-007: Extract Ontology Pack Docs Renderers

**Description:** As a pack authoring maintainer, I want definition doc scaffold rendering separated from scaffold planning so docs templates can evolve independently from path and diagnostics policy.

**Acceptance Criteria:**
- [x] Create a focused docs renderer module for pack definition documents.
- [x] Move `renderSpecDoc`, `renderTodoDoc`, `renderPlanDoc`, `renderRuleDoc`, `renderCasesDoc`, and `renderTestDoc` out of `ontology-pack-scaffold-plan.ts`.
- [x] Preserve deterministic docs skeleton output.
- [x] Preserve valid definition-catalog frontmatter.
- [x] Preserve architecture-neutral identity/data/system separation text in generated spec skeletons.
- [x] Existing scaffold plan/write tests pass.
- [x] Add or adjust focused docs renderer tests if needed.

### US-008: Extract Ontology Pack Code And Test Renderers

**Description:** As a pack authoring maintainer, I want TypeScript scaffold rendering separated from scaffold planning so code and test templates can evolve independently.

**Acceptance Criteria:**
- [ ] Create focused code and test renderer modules for pack scaffolding.
- [ ] Move `renderComponentSchemaFile`, `renderSystemBindingFile`, and `renderPackTestFile` out of `ontology-pack-scaffold-plan.ts`.
- [ ] Preserve deterministic TypeScript skeleton output.
- [ ] Preserve generated identity constants, component-like schema declarations, and system-like binding sections.
- [ ] Preserve generated test skeleton expectations.
- [ ] Existing scaffold plan/write tests pass.
- [ ] Add or adjust focused code/test renderer tests if needed.

### US-009: Extract Ontology Pack Scaffold Planning Utilities

**Description:** As a CLI maintainer, I want scaffold path, diagnostics, and known-pack candidate helpers separated so pack scaffold planning is easier to reason about.

**Acceptance Criteria:**
- [ ] Split safe path resolution and output conflict detection from plan assembly.
- [ ] Split known-pack candidate generation from plan assembly.
- [ ] Split source-map candidate generation from plan assembly if practical.
- [ ] Preserve CLI flag parsing behavior.
- [ ] Preserve invalid id, unsafe path, and conflicting output diagnostics.
- [ ] Existing scaffold tests pass.
- [ ] Plan assembly remains the orchestrator of identity, files, docs, source-map, and known-pack candidate sections.

### US-010: Extract Ontology Pack Validate Loader And Runtime Validation

**Description:** As a pack authoring maintainer, I want pack reference loading and runtime validation separated from readiness checks so pack validate can be extended safely.

**Acceptance Criteria:**
- [x] Create a loader module for known pack id, JSON file, and built JS/MJS/CJS module loading.
- [x] Preserve default/named pack export detection.
- [x] Preserve ambiguous export diagnostics.
- [x] Create a runtime validation module wrapping `validateOperationalOntologyPack()`.
- [x] Preserve issue shape and runtime summary.
- [x] Add focused tests for loader behavior if not already covered by command tests.
- [x] `ontology pack validate <pack-ref>` behavior remains equivalent.

### US-011: Extract Ontology Pack Readiness Checks

**Description:** As a pack authoring maintainer, I want file/docs/source-map readiness checks separated so readiness policy can later support strict mode without changing runtime validation.

**Acceptance Criteria:**
- [x] Create a file readiness module for implementation/test refs.
- [x] Create a docs/source-map readiness module for matching docs family coverage.
- [x] Preserve `readiness.implementationFiles`, `readiness.testFiles`, `readiness.docs`, and `readiness.sourceMap` JSON shapes.
- [x] Preserve warning-level source-map missing behavior.
- [x] Preserve `valid: true` when readiness has warnings but no errors.
- [x] Add focused tests around partial readiness.
- [x] Existing pack validate command tests pass.

### US-012: Slim Ontology Command Assembly

**Description:** As a CLI maintainer, I want `ontology.ts` to dispatch pack authoring commands through focused handlers so prompt/artifact/activation logic stays separate from pack authoring.

**Acceptance Criteria:**
- [ ] Create `commands/ontology/pack-authoring.ts` or equivalent focused command handler.
- [ ] Move pack scaffold command handling and text/json output into the focused handler.
- [ ] Move pack validate command handling and text/json output into the focused handler.
- [ ] `ontology.ts` no longer defines pack scaffold/validate print helpers or command handling internals.
- [ ] Preserve root `qa-sdk ontology` help output.
- [ ] Preserve `qa-sdk ontology pack --help`, `pack scaffold`, and `pack validate` behavior.
- [ ] `ontology.ts` remains the dispatch surface.
- [ ] Existing ontology command tests pass.

### US-013: Document Refactor Convention

**Description:** As a future contributor, I want the refactor convention documented so new docs and ontology command features do not re-grow the command files.

**Acceptance Criteria:**
- [ ] Update docs-control-plane README or related spec with command assembly convention.
- [ ] Document that command files should dispatch/print while library modules own reusable read-model and transformation logic.
- [ ] Document readiness result convention: `valid`, `issues`, `runtime`, and `readiness`.
- [ ] Document dry-run/write convention for scaffold-like commands.
- [ ] Document identity/data/system module separation as an implementation organization guideline, not an ECS-only architecture.
- [ ] Document extracted modules as internal CLI libraries; no package-level public exports are required by this refactor.
- [ ] Do not introduce new behavior in this story.

### US-014: Verify Refactor Operationally

**Description:** As a reviewer, I want operational evidence that the refactor preserved command behavior and improved structure.

**Acceptance Criteria:**
- [ ] Run `docs status docs-control-plane --json` and compare key fields: `nextFollowUps`, `completedRecords`, `roleCoverage`, diagnostics.
- [ ] Run `docs status programming-artifact-ontology-system --json` and confirm deferred follow-ups remain categorized.
- [ ] Run `docs drift --prd tasks/prd-docs-topdown-lifecycle-inventory-alignment.json --json`.
- [ ] Run `docs drift --prd tasks/prd-ontology-pack-authoring-control-plane.json --json`.
- [ ] Run `ontology pack scaffold sample-domain-ontology --json`.
- [ ] Run `ontology pack validate programming-artifact-ontology --json`.
- [ ] Run all quality gates.
- [ ] Record any remaining warnings, especially pack readiness partial source-map warnings.

## Functional Requirements

- FR-1: External CLI behavior must remain equivalent unless explicitly documented.
- FR-2: JSON output shapes must remain backward-compatible.
- FR-3: Command files should dispatch, validate top-level command shape, and print output.
- FR-4: Reusable domain logic should live in `packages/cli/src/lib/**` or focused command handler modules.
- FR-5: Docs lifecycle parsing must be reusable outside `docs status`.
- FR-6: Pack scaffold renderers must be deterministic and independent from CLI parsing.
- FR-7: Pack validate runtime validation and readiness validation must remain separate.
- FR-8: Source-map readiness warnings must not become hard errors in this refactor.
- FR-9: No new scaffold behavior should be introduced.
- FR-10: No automatic archive, memo conversion, known-pack registration, or pack activation should be added.
- FR-11: Extracted modules are internal CLI libraries unless a later PRD explicitly promotes them to public package exports.

## Non-Goals

- Adding new user-facing features such as `pack validate --strict`.
- Changing ralph PRD JSON schema.
- Changing docs graph traversal semantics.
- Changing definition-catalog validation semantics.
- Changing pack scaffold output content beyond necessary import path/module moves.
- Rewriting all command files across the repository.
- Introducing ECS-specific runtime architecture.
- Introducing a general Markdown AST parser for TODO parsing.
- Creating package-level public exports for the extracted modules.

## Technical Considerations

- Primary files:
  - `packages/cli/src/commands/docs.ts`
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/lib/ontology-pack-scaffold-plan.ts`
  - `packages/cli/src/lib/ontology-pack-validate.ts`
  - `packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts`
  - `packages/cli/src/lib/docs-control-plane/drift.ts`
- Candidate new modules:
  - `packages/cli/src/lib/docs-control-plane/todo-lifecycle.ts`
  - `packages/cli/src/lib/docs-control-plane/completed-records.ts`
  - `packages/cli/src/lib/docs-control-plane/follow-ups.ts`
  - `packages/cli/src/lib/docs-control-plane/role-matrix.ts`
  - `packages/cli/src/commands/ontology/pack-authoring.ts`
  - `packages/cli/src/lib/ontology-pack-scaffold/render-docs.ts`
  - `packages/cli/src/lib/ontology-pack-scaffold/render-code.ts`
  - `packages/cli/src/lib/ontology-pack-scaffold/render-tests.ts`
  - `packages/cli/src/lib/ontology-pack-scaffold/paths.ts`
  - `packages/cli/src/lib/ontology-pack-validate/load-pack.ts`
  - `packages/cli/src/lib/ontology-pack-validate/readiness.ts`
- Keep existing tests as behavioral guards before moving code.
- Prefer extraction with minimal edits over opportunistic rewrites.
- Do not add barrel exports unless required for local imports.

## Success Metrics

- `docs.ts` and `ontology.ts` lose major business-logic sections and become easier to scan.
- Extracted modules have focused tests.
- Existing docs and ontology command tests pass.
- Pack scaffold and validate outputs remain stable.
- Future PRDs can add strict readiness or lifecycle inventory commands without editing large command files heavily.
- No new drift is introduced.

## Open Questions

- Should extracted docs modules live directly under `docs-control-plane`, or introduce a `docs-lifecycle` subfolder?
- Should pack validate be split into a folder immediately, or first into one or two modules?
- Should docs command printing helpers also be split, or left in command files for now?
- Should refactor stories update import paths only, or also add internal barrel exports for the new modules?
[/PRD] 
