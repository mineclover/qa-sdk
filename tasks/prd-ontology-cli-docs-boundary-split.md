[PRD]
# PRD: Ontology CLI And Docs Boundary Split

## Overview

The ontology CLI and ontology documentation have grown past a maintainable single-boundary shape. `packages/cli/src/commands/ontology.ts` now owns activation, artifact registry, prompt extraction, quality-status evidence, ingest/status/diff surfaces, and several route/corridor/checkpoint/junction commands in one file. Several ontology specs also exceed leaf-document size and mix lifecycle, CLI, evidence, scenario, and provider concerns in one document family.

This PRD splits the implementation and documents along the same operational boundaries. The change is a behavior-preserving refactor: public command usage, JSON payload shapes, activation lifecycle semantics, evidence persistence, and existing test names should remain stable unless a story explicitly documents a source-reference-only adjustment.

## Goals

- Split ontology CLI code into smaller modules that match current command and evidence boundaries.
- Split oversized ontology docs into module/leaf families that match the code boundaries.
- Keep existing CLI behavior, command paths, output JSON shapes, and failure contracts stable.
- Improve source references so docs control plane can follow bottom-up code-to-doc paths.
- Keep `qa-sdk docs status`, `docs drift`, and `def validate` green after each story.
- Prepare the system for future pack authoring and traversal-mode work without adding those features in this PRD.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- ontology` - ontology CLI regression tests
- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane regression tests
- `pnpm --filter @qa-sdk/cli test -- def` - definition CLI regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter operational-ontology test -- programming-artifacts` - programming artifact ontology regression
- `pnpm --filter operational-ontology typecheck` - operational ontology type checking
- `pnpm --filter authorization-ontology test` - authorization ontology regression
- `pnpm --filter authorization-ontology typecheck` - authorization ontology type checking
- `pnpm --filter definition-catalog test` - definition-catalog document graph regression
- `pnpm --filter definition-catalog typecheck` - definition-catalog type checking
- `node packages/cli/dist/index.js def validate` - repository definition validation

No browser verification is required.

## User Stories

### US-001: Inventory Current Ontology CLI And Documentation Boundaries

**Description:** As a maintainer, I want the current ontology CLI functions and ontology document families mapped before splitting so that the refactor follows the existing system shape.

**Acceptance Criteria:**
- [x] Produce an inventory section in this PRD or a companion note listing major `packages/cli/src/commands/ontology.ts` function groups.
- [x] Inventory includes activation, artifact registry, prompt extraction, prompt artifact extraction, quality-status evidence, quality-ledger evidence, ingest/status, and route/corridor/checkpoint/junction/diff surfaces.
- [x] Inventory lists current oversized ontology docs and their proposed target families.
- [x] Confirm no public command path should change in this PRD.
- [x] Confirm no activation lifecycle, rollback, REST, remote activation, scoped prefix, or pack authoring behavior is added.
- [x] Record the target module file names before implementation begins.

#### US-001 Current Inventory

This inventory records the current shape before any extraction. It is descriptive only: later stories must preserve public command paths, JSON fields, text output contracts, activation lifecycle semantics, evidence append behavior, and existing test titles unless a later story explicitly narrows a source-reference-only adjustment.

##### CLI Function Groups

| Current group in `packages/cli/src/commands/ontology.ts` | Current symbols and line area | Target module file before implementation |
| --- | --- | --- |
| Activation | activation flag constants, `parseRegistryActivatePackArgs`, prefix/address-model parsing, activation error/output helpers, `withActivationEvidence`, `knownOntologyPackImportRef`, `cmdRegistryActivatePack` | `packages/cli/src/commands/ontology/activation.ts` |
| Artifact registry | `ProgrammingArtifactRegistryFile`, registry load/save helpers, `validateProgrammingArtifactRegistryRecords`, CSV/metadata parsing, record creation, `cmdArtifactRegistryValidate`, `cmdArtifactRegistryList`, `cmdArtifactRegistryAppend` | `packages/cli/src/commands/ontology/artifact-registry.ts` |
| Prompt extraction | prompt artifact kind/use-case parsing, `materializePromptArtifacts`, prompt output resolution, definition body/link helpers, governance evidence persistence, `cmdPromptExtract`, `cmdPromptExtractFile`, `cmdPromptExtractPermission` | `packages/cli/src/commands/ontology/prompt-extract.ts` |
| Prompt artifact extraction | artifact source types, artifact type inference, registry hit/miss/fallback source helpers, artifact source flags, direct artifact registry provider loading, `cmdPromptExtractArtifact` | `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` |
| Quality-status evidence | quality-status snapshot/source types, related quality-status matching, descriptor resolution, snapshot candidate loading, snapshot summaries, snapshot warning conversion, prompt quality evidence conversion | `packages/cli/src/commands/ontology/quality-status-evidence.ts` |
| Quality-ledger evidence | `loadQualityStatusLedger`, ledger open/close handling, freshness policy parsing, ledger fallback decision, ledger evidence summaries, freshness evidence, conflict/incomplete warnings, governance closure helpers | `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` |
| Ingest/status | local store path/load/save helpers, ingest option parsing, `cmdSnapshotIngest`, `cmdEventIngest`, `cmdPipeIngest`, `cmdSnapshotList`, `cmdSnapshotShow`, `cmdStatus`, snapshot diff handlers | `packages/cli/src/commands/ontology/store.ts`, `packages/cli/src/commands/ontology/ingest.ts`, `packages/cli/src/commands/ontology/status.ts` |
| Route/corridor/checkpoint/junction/diff surfaces | corridor list/show/show-latest/diff, checkpoint list/show/diff, route list/show/diff, traversal list/show/diff, junction list/show/diff handlers | `packages/cli/src/commands/ontology/navigation-diff.ts` |
| Router | `cliOntology` help text and command switch | `packages/cli/src/commands/ontology.ts` remains the thin router/import owner |

##### Command Path Freeze

No public command path changes in this PRD. The frozen paths include:

- `qa-sdk ontology registry activate-pack <pack-id>`
- `qa-sdk ontology prompt extract`, `extract-file`, `extract-permission`, and `extract-artifact`
- `qa-sdk ontology artifact registry validate`, `list`, and `append`
- `qa-sdk ontology snapshot ingest`, `list`, `show`, `diff`, and `diff-latest`
- `qa-sdk ontology event ingest` and `qa-sdk ontology pipe ingest`
- `qa-sdk ontology status`
- `qa-sdk ontology corridor`, `checkpoint`, `junction`, `route`, and `traversal` list/show/diff/latest variants

##### Scope Lock

This PRD adds no activation lifecycle behavior, rollback or compensating rollback behavior, registry-service REST endpoint, remote activation service, scoped prefix schema/API behavior, pack authoring CLI, dynamic external pack loading, or traversal mode behavior. Those remain follow-up surfaces outside this boundary split.

##### Oversized Ontology Docs And Target Families

Line counts are the current pre-split inventory from the working tree. Proposed families name the destination document boundary, not a behavior expansion.

| Current oversized doc | Current size | Proposed target family |
| --- | ---: | --- |
| `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md` | 426 lines | Promote to `operational-ontology-registry-allocation` module overview with leaves for lifecycle, activation CLI, activation result, activation evidence, scenario matrix, persistence handoff, index-meta sync handoff, validation contract, and scoped-prefix decision. |
| `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md` | 388 lines | Keep as registry allocation follow-up checklist leaf after completed/current-state material moves to the module leaves. |
| `docs/specs/operational-ontology/operational-ontology-persistence.spec.md` | 355 lines | Split later into persistence model, ingest/query helpers, snapshot projection, diff/query surfaces, and store adapter leaves; this PRD only updates source references when CLI ingest/status modules move. |
| `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md` | 350 lines | Keep as CLI command contract leaf and move provider lookup, activation evidence consumption, quality-status evidence, ledger fallback, freshness, and governance closure details into programming artifact provider/evidence leaves. |
| `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md` | 303 lines | Keep focused on command surface/local runtime boundary; move activation result payload and activation evidence persistence into dedicated registry leaves. |
| `docs/specs/operational-ontology/operational-ontology-system.spec.md` | 231 lines | Keep as high-level group entry and reduce detailed registry/programming artifact behavior to contained module/leaf references. |
| `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md` | 219 lines | Keep as guide leaf unless future edits add independent provider/evidence procedure sections; do not expand in this PRD. |
| `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md` | 212 lines | Keep or tighten as programming artifact module overview with contained provider, activation evidence, quality evidence, CLI, simulation, plan, and todo leaves. |
| `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md` | 210 lines | Keep as index-meta sync handoff leaf under the registry allocation family; avoid mixing activation CLI/evidence text into it. |
| `docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md` | 206 lines | Keep as persistence handoff leaf under the registry allocation family; avoid mixing service activation/runtime CLI text into it. |
| `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md` | 178 lines | Keep as prompt artifact generation leaf; link to programming artifact quality evidence for registry/quality-status closure details. |
| `docs/specs/operational-ontology/operational-ontology-production-factory.spec.md` | 155 lines | Keep as production factory leaf for now; future edits should split factory coordinate, matching, and adjustment policy if expanded. |
| `docs/specs/operational-ontology/operational-ontology-ssot-navigation-guide.spec.md` | 154 lines | Keep as navigation guide leaf for now; future edits should split by schema, registry, address, observation, and source-map navigation lanes if expanded. |

### US-002: Promote Registry Allocation Documentation To Module And Leaf Structure

**Description:** As a documentation maintainer, I want the registry allocation document family split into module and leaf specs so lifecycle, activation, evidence, and scenario concerns have stable coordinates.

**Acceptance Criteria:**
- [x] Convert `operational-ontology-registry-allocation` into a module-level overview if it owns multiple leaf concerns.
- [x] Add or update contains links for lifecycle, activation CLI, activation result, activation evidence, and activation scenario matrix leaf docs.
- [x] Create or update `operational-ontology-registry-lifecycle.spec.md` for Phase 2A through Phase 5 lifecycle current state.
- [x] Create or update `operational-ontology-registry-activation-result.spec.md` for activation result payload, no-rollback policy, and structured failure semantics.
- [x] Create or update `operational-ontology-registry-activation-evidence.spec.md` for `--output`, `--artifact-registry`, `activation-evidence`, registry append/upsert, and provider consumption behavior.
- [x] Keep `operational-ontology-registry-activation-cli.spec.md` focused on command surface and local runtime boundary.
- [x] Keep `operational-ontology-registry-activation-cli-scenario-matrix.spec.md` focused on scenario proof and evidence references.
- [x] Update sources and links so `qa-sdk docs status operational-ontology-registry-allocation` shows the intended family without unrelated PRDs.

### US-003: Split Programming Artifact Ontology Documentation By Provider And Evidence Concerns

**Description:** As a programming artifact ontology maintainer, I want CLI, provider, activation evidence, and quality-status evidence concerns split so future artifact work has precise document coordinates.

**Acceptance Criteria:**
- [x] Keep `programming-artifact-ontology-system` as a module or concise system overview.
- [x] Create or update `programming-artifact-ontology-registry-provider.spec.md` for `ArtifactRegistryPromptArtifactContextProvider` and generic registry lookup behavior.
- [x] Create or update `programming-artifact-ontology-activation-evidence.spec.md` for activation evidence artifact kind and provider consumption.
- [x] Create or update `programming-artifact-ontology-quality-evidence.spec.md` for quality-status, quality ledger fallback, freshness SLA, and governance closure behavior.
- [x] Keep `programming-artifact-ontology-cli.spec.md` focused on CLI command contracts and flag behavior.
- [x] Update contains/depends_on/refines links so top-down docs traversal can assemble the programming artifact ontology module without mixing implementation details into the overview.
- [x] Update source references to the split CLI modules created later in this PRD when applicable.

### US-004: Establish Source Reference And Docs Control-Plane Checks For Split Boundaries

**Description:** As a docs control-plane user, I want split docs to have source references and status checks so bottom-up code-to-doc lookup becomes practical.

**Acceptance Criteria:**
- [x] Add source references for the new or updated ontology docs to the future split module paths where possible.
- [x] Keep source references conservative when a module has not yet been extracted.
- [x] Run `qa-sdk docs status` on the registry allocation family and programming artifact ontology family and record whether family scope is narrow enough.
- [x] Run `qa-sdk docs collect` for at least one new leaf doc and ensure unrelated PRD families do not dominate the result.
- [x] Do not add source comments or `@def.doc` annotations in this story unless needed for a concrete missing bottom-up lookup.
- [x] Record any source-map coverage gaps as follow-up TODOs instead of widening current scope.

#### US-004 Control-Plane Evidence

Future split module paths are recorded in the owning ontology leaf bodies as body-only source reference boundaries. Frontmatter `sources` stay on existing files such as `packages/cli/src/commands/ontology.ts` until US-005 through US-009 create the split modules, so no broken source paths are introduced.

Status checks:

- `qa-sdk docs status operational-ontology-registry-allocation --json`: 13 related family members, 81 sources, 0 tasks, 0 diagnostics. Scope is narrow enough: it resolves to the registry allocation module/leaf/todo/plan family and does not pull PRD task documents.
- `qa-sdk docs status programming-artifact-ontology-system --json`: 12 related family members, 38 sources, 0 tasks, 0 diagnostics. Scope is narrow enough: it resolves to the programming artifact ontology module family and does not pull PRD task documents.

Collect check:

- `qa-sdk docs collect operational-ontology-registry-activation-evidence --json`: 3 related family members, 18 sources, 0 tasks, 0 diagnostics. The result contains the activation evidence leaf, its scenario matrix, and the registry allocation module; unrelated PRD families do not dominate the result.

Source-map coverage gaps are recorded as TODO items in `operational-ontology-registry-allocation.todo.md` and `programming-artifact-ontology-todo.todo.md`. This story adds no source comments and no `@def.doc` annotations.

### US-005: Extract Ontology Activation CLI Module

**Description:** As a CLI maintainer, I want activation command parsing, errors, output, and evidence append orchestration extracted from `ontology.ts` so activation behavior has a dedicated implementation boundary.

**Acceptance Criteria:**
- [ ] Move registry activation value/boolean flag definitions, parser, prefix override parsing, address model parsing, activation CLI failure result construction, output sidecar writing, text summary printing, known pack import refs, and `cmdRegistryActivatePack` into a dedicated module such as `packages/cli/src/commands/ontology/activation.ts`.
- [ ] Keep `qa-sdk ontology registry activate-pack <pack-id>` command path unchanged.
- [ ] Keep JSON output shape unchanged for success, helper failure, command-level failure, output write failure, and append failure.
- [ ] Keep `--output` sidecar raw helper payload behavior unchanged.
- [ ] Keep `--artifact-registry` explicit append behavior unchanged.
- [ ] Leave `packages/cli/src/commands/ontology.ts` as the router/import owner for this command.
- [ ] Update tests only for import paths if required; do not rename existing activation scenario test titles.

### US-006: Extract Programming Artifact Registry CLI Module

**Description:** As a CLI maintainer, I want artifact registry validate/list/append behavior extracted from `ontology.ts` so registry management is a separate boundary from activation and prompt extraction.

**Acceptance Criteria:**
- [ ] Move programming artifact registry file shape, registry load/save helpers, registry validation, comma value parsing, optional metadata parsing, registry record creation from flags, and `artifact registry validate/list/append` command handlers into a dedicated module such as `packages/cli/src/commands/ontology/artifact-registry.ts`.
- [ ] Keep `qa-sdk ontology artifact registry validate`, `list`, and `append` command paths unchanged.
- [ ] Keep array and `{ artifacts: [...] }` registry input/output compatibility unchanged.
- [ ] Keep activation-evidence records valid under registry validate/list behavior.
- [ ] Preserve append/upsert behavior by artifact identity.
- [ ] Update docs source references for artifact registry provider and activation evidence docs.

### US-007: Extract Quality Status Matching And Snapshot Module

**Description:** As a CLI maintainer, I want quality-status registry matching, snapshot loading, descriptor resolution, and snapshot warning code extracted so prompt artifact quality evidence has a dedicated source/snapshot boundary.

**Acceptance Criteria:**
- [ ] Move quality-status record summary, governance closure summary shell, quality-status matching, snapshot loading, descriptor resolution, snapshot candidate paths, snapshot summary, and snapshot warning helpers into a dedicated module such as `packages/cli/src/commands/ontology/quality-status-evidence.ts`.
- [ ] Keep `extract-artifact --quality-ledger` and `--quality-status-max-age-days` behavior unchanged.
- [ ] Keep snapshot-first authority unchanged.
- [ ] Keep source JSON fields for `source.qualityStatusRecords`, `source.governanceClosure`, and prompt quality metrics unchanged.
- [ ] Preserve existing quality-status snapshot/matching related tests and test titles.
- [ ] Leave ledger fallback and freshness implementation in place until US-008 extracts it.

### US-008: Extract Quality Ledger, Freshness, And Governance Closure Module

**Description:** As a CLI maintainer, I want quality-ledger fallback, freshness SLA, conflict warnings, and governance closure prompt evidence extracted so optional quality evidence policy is separate from command routing.

**Acceptance Criteria:**
- [ ] Move quality-ledger loading, ledger fallback decisions, freshness policy, snapshot/ledger conflict warning, prompt evidence outcome conversion, governance closure evaluation, and governance run helpers into a dedicated module such as `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` or a submodule imported by `quality-status-evidence.ts`.
- [ ] Keep `extract-artifact --quality-ledger` behavior unchanged.
- [ ] Keep `--quality-status-max-age-days` behavior unchanged.
- [ ] Keep ledger conflict warning policy unchanged.
- [ ] Keep governance closure JSON output fields unchanged.
- [ ] Preserve existing quality-ledger, freshness, and governance closure tests and test titles.
- [ ] Update programming artifact quality evidence docs source references to the new module.

### US-009: Extract Prompt Artifact Extraction Module

**Description:** As a CLI maintainer, I want artifact prompt extraction separated from the monolithic ontology command file so registry lookup, file/doc/search fallback, and quality evidence integration have a clear boundary.

**Acceptance Criteria:**
- [ ] Move artifact extraction source types, registry hit/miss/fallback source helpers, artifact source flags, artifact type inference, `cmdPromptExtractArtifact`, and direct artifact registry provider loading into a dedicated module such as `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`.
- [ ] Keep `qa-sdk ontology prompt extract-artifact <artifact-ref>` command path unchanged.
- [ ] Keep source JSON shape for `artifact-registry-hit`, `artifact-registry-miss`, file fallback, definition fallback, and search fallback unchanged.
- [ ] Keep related quality-status evidence integration unchanged.
- [ ] Preserve prompt artifact extraction tests and test titles.
- [ ] Update programming artifact CLI and provider docs source references to the new module.

### US-010: Extract Ontology Ingest And Status Support Module

**Description:** As a CLI maintainer, I want local store, ingest, status, and snapshot show/list behavior grouped into a support module so non-prompt ontology operations start leaving the monolith.

**Acceptance Criteria:**
- [ ] Move local store load/save helpers into a shared support module or the ingest/status module.
- [ ] Move snapshot/event/pipe ingest handlers into a dedicated module such as `packages/cli/src/commands/ontology/ingest.ts`.
- [ ] Move status, snapshot list, and snapshot show handlers into a dedicated module such as `packages/cli/src/commands/ontology/status.ts`.
- [ ] Keep public command paths and text/JSON output stable.
- [ ] Keep `packages/cli/src/commands/ontology.ts` responsible for routing and imports for these commands.
- [ ] Avoid circular imports between extracted modules.
- [ ] Update any tests that import helper internals to use the new paths or public command path.

### US-011: Extract Ontology Route, Corridor, Checkpoint, Junction, And Traversal Diff Module

**Description:** As a CLI maintainer, I want route/corridor/checkpoint/junction/traversal list/show/diff handlers separated from ingest/status so graph navigation command surfaces have a clear module.

**Acceptance Criteria:**
- [ ] Move corridor, checkpoint, route, traversal, and junction list/show/diff/latest handlers into a dedicated module such as `packages/cli/src/commands/ontology/navigation-diff.ts`.
- [ ] Keep public command paths and text/JSON output stable.
- [ ] Keep snapshot diff in the ingest/status module or move it here only if the story documents the chosen boundary.
- [ ] Keep `packages/cli/src/commands/ontology.ts` responsible for routing and imports for these commands.
- [ ] Avoid circular imports between extracted modules.
- [ ] Update any tests that import helper internals to use the new paths or public command path.
- [ ] Record any remaining intentionally unextracted helper groups in a follow-up note.

### US-012: Update Ontology Docs, Sources, And Control-Plane Status After Code Split

**Description:** As a documentation maintainer, I want all split docs to reference the new code modules so docs control plane status and drift checks remain useful.

**Acceptance Criteria:**
- [x] Update `sources` or top-level `source:` entries for affected ontology specs to point at extracted modules where appropriate.
- [x] Update `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md` to record this boundary split as complete when implemented.
- [x] Update `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md` if provider or quality evidence follow-ups change.
- [x] Run `qa-sdk docs status` for the registry allocation family, activation CLI leaf, activation evidence leaf, programming artifact system family, and programming artifact CLI leaf.
- [x] Run `qa-sdk docs drift --prd <converted-prd-json>` after this PRD is converted and completed.
- [x] Keep REST activation endpoint, remote activation service, pack authoring CLI, dynamic pack loading, and traversal mode implementation as follow-ups.

#### US-012 Control-Plane Evidence

Updated activation and programming artifact source references now point at extracted modules where they own behavior. `packages/cli/src/commands/ontology.ts` remains only where docs explicitly describe stable router dispatch or generic prompt dependency handoff.

Status checks:

- `qa-sdk docs status operational-ontology-registry-allocation --json`: 13 family members, 83 sources, 0 tasks, 0 diagnostics.
- `qa-sdk docs status operational-ontology-registry-activation-cli --json`: 7 family members, 33 sources, 0 tasks, 0 diagnostics.
- `qa-sdk docs status operational-ontology-registry-activation-evidence --json`: 3 family members, 20 sources, 0 tasks, 0 diagnostics.
- `qa-sdk docs status programming-artifact-ontology-system --json`: 12 family members, 57 sources, 0 tasks, 0 diagnostics.
- `qa-sdk docs status programming-artifact-ontology-cli --json`: 4 family members, 13 sources, 0 tasks, 0 diagnostics.
- `qa-sdk docs drift --prd tasks/prd-ontology-cli-docs-boundary-split.json --json`: 0 errors, 2 warnings. Both warnings are Ralph session metadata count drift in `.ralph-tui/session-meta.json` (`totalTasks` and `tasksCompleted`), not ontology document/source drift.

Follow-ups remain unchanged for registry-service REST activation, remote activation service behavior, pack authoring CLI, dynamic external pack loading, and traversal mode implementation.

### US-013: Verify Behavior Preservation And File Size Reduction

**Description:** As a reviewer, I want proof that the split preserved behavior and made the code/docs easier to operate.

**Acceptance Criteria:**
- [ ] `packages/cli/src/commands/ontology.ts` is reduced to a thin router or at least below 1,500 lines after extraction.
- [ ] No extracted module exceeds 1,500 lines unless the story documents why it remains a follow-up.
- [ ] Existing ontology CLI tests pass without public command behavior changes.
- [ ] Activation CLI scenario matrix still references valid test titles after the split.
- [ ] `qa-sdk docs status packages/cli/src/commands/ontology.ts` or the closest supported bottom-up query reports a clear limitation or source mapping path instead of returning the full repository.
- [ ] `node packages/cli/dist/index.js docs drift --prd tasks/prd-ontology-cli-docs-boundary-split.json --json` reports zero issues after this PRD is complete.
- [ ] Record residual refactor debt in the appropriate TODO, not in implementation comments.

## Functional Requirements

- FR-1: Public `qa-sdk ontology` command paths must remain stable.
- FR-2: Public JSON payload shapes for activation, artifact registry, prompt extraction, quality evidence, and status/diff commands must remain stable.
- FR-3: Documentation split must follow definition-catalog module/leaf conventions.
- FR-4: New docs must have purpose markers and appropriate `contains`, `depends_on`, `refines`, or `traces_to` links.
- FR-5: Source references must point at extracted implementation modules where practical.
- FR-6: This PRD must not introduce REST activation, remote activation, scoped prefix support, pack authoring CLI, or traversal mode behavior.
- FR-7: Refactor must be behavior-preserving and test-driven.

## Non-Goals

- Adding arbitrary external pack loading.
- Adding pack scaffolding or pack authoring commands.
- Adding REST activation endpoints.
- Adding remote activation service or deployment workflow.
- Changing scoped prefix policy.
- Changing activation rollback policy.
- Changing artifact registry JSON format.
- Changing prompt extraction quality scoring semantics.
- Implementing top-down/bottom-up traversal modes in `qa-sdk docs`.

## Technical Considerations

- Main file to split:
  - `packages/cli/src/commands/ontology.ts`
- Existing command group:
  - `packages/cli/src/command-groups/ontology.commands.ts`
- Candidate new module directory:
  - `packages/cli/src/commands/ontology/`
- High-risk behavior surfaces:
  - activation result JSON and sidecar
  - activation evidence append/upsert
  - quality-status governance closure
  - prompt extraction source/fallback JSON
  - existing route/diff/status command output
- Oversized docs to split or reduce:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
- Use `qa-sdk docs status`, `docs collect`, and `docs drift` to validate document family shape after each documentation story.

## Success Metrics

- `ontology.ts` is no longer the implementation home for activation, artifact registry, quality evidence, prompt artifact extraction, ingest/status, and diff surfaces.
- Registry allocation docs become module/leaf structured instead of one oversized leaf.
- Programming artifact ontology docs separate provider behavior, activation evidence, quality evidence, and CLI command contracts.
- Existing behavior remains stable under the current ontology, docs, operational-ontology, authorization-ontology, and definition-catalog gates.
- Docs control plane can inspect the new doc families without pulling unrelated PRD families into status output.

## Open Questions

- Should route/corridor/checkpoint/junction diff handlers split into separate modules now, or remain grouped as `status-diff.ts` until a later traversal-mode PRD?
- Should source-map comments such as `@def.doc` be added to extracted modules in this PRD, or should source references remain frontmatter-only for now?
[/PRD]
