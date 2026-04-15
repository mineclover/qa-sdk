[PRD]
# PRD: Docs Control Plane And Compatibility Adapters

## Overview

Unify document verification, document information collection, metadata transformation, search, and PRD workflow handling behind a CLI-first docs control plane. The control plane must treat repository documents as the source of truth and use adapters to read/write compatible formats such as definition markdown, PRD markdown, ralph-tui PRD JSON, ralph session metadata, and artifact evidence.

This PRD is not a PRD-JSON management feature. PRD JSON exists for ralph-tui execution and must remain a compatibility adapter under the docs control plane. PRD creation itself must also be driven by the docs control plane: it should collect existing docs, open TODOs, specs, source references, scenario matrices, and prior PRD state before producing a new PRD or PRD JSON.

## Goals

- Define a neutral document control-plane model that can represent multiple document families without making PRD JSON the core schema.
- Add adapters for definition markdown, PRD markdown, ralph-tui PRD JSON, ralph session metadata, and artifact evidence.
- Provide CLI commands for document status, validation, drift detection, collection, search, and metadata transformations.
- Make PRD creation and PRD JSON conversion consume control-plane context instead of operating as standalone string transformations.
- Default all write operations to dry-run. This PRD implements metadata transform planning and dry-run previews only; `--apply` is deferred to a later PRD after the control-plane change-set format is stable.
- Preserve existing `qa-sdk def` behavior as definition-catalog primitive commands while adding `qa-sdk docs` as the cross-document control plane.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane CLI tests
- `pnpm --filter @qa-sdk/cli test -- def` - definition CLI regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter definition-catalog test` - definition parser/frontmatter/validation regression
- `pnpm --filter definition-catalog typecheck` - definition-catalog type checking
- `pnpm --filter definition-data-source test` - scan/local DB data-source regression
- `pnpm --filter definition-data-source typecheck` - definition-data-source type checking
- `node packages/cli/dist/index.js def validate` - repository definition validation

No browser verification is required.

## User Stories

### US-001: Define Docs Control Plane Boundary And Envelope Contract

**Description:** As a document system maintainer, I want a neutral control-plane contract so definition docs, PRDs, ralph JSON, sessions, and evidence can be queried consistently without merging their source schemas.

**Acceptance Criteria:**
- [ ] Add a docs control-plane module boundary, for example `packages/cli/src/lib/docs-control-plane/` or a similarly local CLI support module.
- [ ] Define `DocumentEnvelope` with adapter id, kind, stable id, optional family id, path, metadata, links, sources, sections, tasks, evidence, diagnostics, and raw source pointer.
- [ ] Define `DocumentAdapter` with read-only collection methods and optional write/transform capability flags.
- [ ] Define `DocumentTask`, `DocumentEvidence`, `DocumentDiagnostic`, and `DocumentChangeSet` types.
- [ ] State in code comments and docs that repository files remain SSOT; the control plane is an index/coordination layer.
- [ ] Do not add REST, remote services, database migrations, or new artifact vocabulary in this story.
- [ ] Add unit tests for envelope normalization and adapter capability declarations.

### US-002: Implement Definition Markdown Adapter

**Description:** As a docs CLI user, I want definition markdown files to be collected through the control plane so existing definition-catalog metadata stays reusable.

**Acceptance Criteria:**
- [ ] Add a `definition-markdown` adapter that uses existing `definition-catalog` scanning/parsing helpers instead of ad hoc parsing.
- [ ] Collect `def.id`, type, knowledge kind, level, scope, aspect, depth, lifecycle, layer, tags, links, `svc`, sources, purpose, overview, and source path.
- [ ] Preserve existing `qa-sdk def validate`, `def search`, `def sync`, and `def scan-audit` behavior.
- [ ] Surface group/module/leaf diagnostics from existing validation where available.
- [ ] Represent `.spec.md`, `.todo.md`, `.plan.md`, `.test.md`, `.memo.md`, and `.rule.md` as document family members when they share a family id or basename convention.
- [ ] Add tests with temporary docs covering spec/todo/plan family detection and frontmatter extraction.

### US-003: Implement PRD Markdown, Ralph JSON, And Session Adapters

**Description:** As a workflow maintainer, I want PRD formats and ralph execution state to be compatible adapters so execution state can be compared against docs without becoming the core document model.

**Acceptance Criteria:**
- [ ] Add a `prd-markdown` adapter that reads `[PRD]...[/PRD]`, overview, goals, quality gates, user stories, acceptance criteria, functional requirements, non-goals, and open questions.
- [ ] Add a `ralph-prd-json` adapter that validates flat root `{ name, branchName, description, userStories }`.
- [ ] Reject or warn on schema anti-patterns: root `prd`, root `tasks`, root `metadata`, story `status`, non-boolean `passes`, missing `dependsOn`.
- [ ] Map `userStories[]` to control-plane tasks with `passes`, dependencies, notes, completion notes, and quality gates.
- [ ] Add a `ralph-session` adapter for `.ralph-tui/session-meta.json`.
- [ ] Detect drift when PRD JSON has all stories passing but session status is still `running`, or when session task counts disagree with PRD story state.
- [ ] Add tests using `tasks/prd-ontology-registry-cli-scenario-hardening.json`-style fixtures.

### US-004: Implement Artifact Evidence Adapter

**Description:** As a verification reviewer, I want artifact registry evidence to be collected into the docs control plane so documents can be reviewed with their execution proof.

**Acceptance Criteria:**
- [ ] Add an `artifact-evidence` adapter that reads local programming artifact registry JSON files in array or `{ artifacts: [...] }` form.
- [ ] Collect artifact id, kind, artifact ref, output path, produced-by, derived-from, verifies, owner definition, materializes-output, source refs, verification refs, metadata, and relation edges.
- [ ] Map `activation-evidence` records to document evidence without adding new artifact kind vocabulary.
- [ ] Support filtering evidence by document id, artifact ref, output path, pack id, and kind.
- [ ] Do not require artifact registry files to exist for normal docs status commands; missing evidence sources should be warnings only when explicitly requested.
- [ ] Add tests for activation-evidence records produced by the ontology activation CLI.

### US-005: Add `qa-sdk docs status`, `collect`, And `search`

**Description:** As a maintainer, I want one CLI surface to inspect a document family, collect related facts, and search across document systems.

**Acceptance Criteria:**
- [ ] Add a `qa-sdk docs` command group without replacing `qa-sdk def`.
- [ ] Register the docs command group in `packages/cli/src/index.ts` so dispatch and help routing work through the same command registry pattern as `qa-sdk def`.
- [ ] Implement `qa-sdk docs status [doc-id|path] [--json]`.
- [ ] Implement `qa-sdk docs collect <doc-id|path> [--json]` to show family members, metadata, links, sources, tasks, evidence, and diagnostics.
- [ ] Implement `qa-sdk docs search <query> [--kind ...] [--metadata key=value] [--json]`.
- [ ] Search must include definition markdown and PRD adapters at minimum.
- [ ] Status output must identify next open follow-up state when PRD/session/todo evidence is available.
- [ ] Add root dispatch/help tests proving `qa-sdk docs` routes through the command registry.
- [ ] Add CLI tests for text and JSON output.

### US-006: Add `qa-sdk docs drift`

**Description:** As a document operator, I want drift detection across specs, todos, PRDs, ralph sessions, scenario matrices, and evidence so completion state can be trusted.

**Acceptance Criteria:**
- [ ] Implement `qa-sdk docs drift [--prd <file>] [--json]`.
- [ ] Detect PRD JSON complete but ralph session still `running`.
- [ ] Detect PRD JSON complete but matching PRD markdown acceptance criteria remain unchecked.
- [ ] Detect TODO open item that is described as completed in spec or PRD notes.
- [ ] Detect scenario matrix `E-*` references whose test title no longer exists.
- [ ] Detect document source references that point to missing files.
- [ ] Detect group/module docs without `contains` links and leaf docs with `contains` links by reusing definition validation where possible.
- [ ] Drift output must group issues by severity and include file paths plus remediation hints.
- [ ] Add tests using the recently completed CLI scenario hardening PRD/session pattern.

### US-007: Add Metadata Transform Dry-Run

**Description:** As a documentation maintainer, I want safe batch metadata transform previews so lifecycle, level, tags, links, and source refs can be planned consistently before any file mutation exists.

**Acceptance Criteria:**
- [ ] Implement `qa-sdk docs transform metadata --rule <json-file|inline-json> --dry-run`.
- [ ] Make dry-run the default when `--dry-run` is omitted.
- [ ] Do not implement `--apply` in this PRD.
- [ ] If `--apply` is provided, return a structured unsupported-operation error that points to a later apply PRD.
- [ ] Use structured frontmatter parsing/writing for definition markdown; do not use broad regex replacements.
- [ ] Support allowlisted transforms for lifecycle, level, tags add/remove, links add/remove, `svc`, and sources.
- [ ] Print a change-set preview with before/after metadata and affected paths.
- [ ] Refuse transforms that would remove `def.id` or convert PRD JSON into definition frontmatter.
- [ ] Add tests for dry-run no-write behavior on temporary docs.

### US-008: Add Control-Plane PRD Authoring Workflow

**Description:** As a planner, I want PRD creation to consume docs control-plane context so new PRDs are grounded in existing specs, TODOs, evidence, and prior ralph state.

**Acceptance Criteria:**
- [ ] Implement `qa-sdk docs prd context <topic|doc-id> [--json]` or equivalent command to collect PRD authoring context.
- [ ] Context must include related specs, open TODOs, plans, prior PRDs, PRD JSON completion state, ralph session state, scenario matrix rows, sources, and evidence.
- [ ] Implement `qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]` or equivalent command to create a PRD skeleton from collected context.
- [ ] Generated PRD skeleton must include overview, goals, quality gates, user story placeholders, non-goals, technical considerations, success metrics, and open questions.
- [ ] Generated PRD skeleton must state its control-plane context sources.
- [ ] PRD authoring must not call ralph-tui directly and must not create PRD JSON unless an explicit adapter command is invoked.
- [ ] Add tests for context collection and scaffold output on temporary fixtures.

### US-009: Add PRD JSON Compatibility Conversion Under Docs Control Plane

**Description:** As a ralph-tui user, I want PRD markdown to be converted into ralph-compatible JSON through the docs control plane so conversion follows the same validation and context rules.

**Acceptance Criteria:**
- [ ] Implement `qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]` or equivalent command.
- [ ] Conversion must use the PRD markdown adapter and ralph JSON adapter, not a standalone string parser.
- [ ] Output JSON must be flat root with `name`, `branchName`, `description`, and `userStories`.
- [ ] Quality gates from PRD markdown must be appended to every story.
- [ ] Dependencies must be derived from story order and explicit prerequisite hints where present.
- [ ] Output must set all incomplete stories to `passes: false`, empty notes, and no story `status`.
- [ ] Conversion must run schema anti-pattern validation before writing.
- [ ] Add tests that convert a fixture PRD and validate the resulting ralph JSON.

### US-010: Add PRD Completion Sync Dry-Run

**Description:** As a docs operator, I want completed PRD JSON to produce a proposed docs update plan so spec/todo/roadmap updates are systematic instead of manual.

**Acceptance Criteria:**
- [ ] Implement `qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--json]`.
- [ ] Dry-run output must summarize completed stories, affected docs, open TODO candidates, spec update candidates, roadmap update candidates, scenario matrix update candidates, and session drift.
- [ ] Do not mutate files in the initial dry-run story.
- [ ] Do not introduce `--apply` in this story; completion sync is dry-run only in this PRD.
- [ ] Sync-completion must not promote a TODO to spec solely because PRD JSON says `passes: true`; it must require source/test/evidence links or report a blocked promotion.
- [ ] Add tests using a completed ralph PRD JSON fixture and a mismatched todo/spec fixture.

### US-011: Reflect Docs Control Plane In Specs And Guides

**Description:** As a documentation maintainer, I want the docs control-plane architecture recorded so future agents use adapters and avoid PRD-centric drift.

**Acceptance Criteria:**
- [ ] Add or update a spec under `docs/specs/definition-catalog/` or `docs/specs/system/` describing the docs control plane, adapter boundary, and SSOT direction.
- [ ] Update relevant CLI/docs guide text to distinguish `qa-sdk def` primitives from `qa-sdk docs` cross-document control plane.
- [ ] Document that PRD JSON is a ralph compatibility adapter, not the core document model.
- [ ] Document dry-run-first write policy and supported transform allowlist.
- [ ] Document when to use `docs prd context`, `docs prd scaffold`, and `docs prd to-ralph-json`.
- [ ] Keep REST, remote document service, and automatic unreviewed spec promotion out of scope.

## Functional Requirements

- FR-1: The system must expose a docs control plane that can collect and normalize multiple document families.
- FR-2: The system must preserve repository markdown/JSON files as the source of truth.
- FR-3: The system must treat PRD JSON as a compatibility adapter for ralph-tui, not as the primary document schema.
- FR-4: PRD authoring must consume control-plane context before producing a PRD skeleton or JSON conversion.
- FR-5: Drift detection must compare at least definition markdown, PRD markdown, ralph PRD JSON, ralph session metadata, scenario matrix references, and source references.
- FR-6: Metadata transforms must default to dry-run. This PRD must not mutate files through `docs transform metadata`; apply behavior is deferred.
- FR-7: Structured parsers/writers must be used for frontmatter and JSON writes.
- FR-8: Search must support text, metadata, kind, id, path, and source-ref oriented queries.
- FR-9: The new `qa-sdk docs` commands must not break existing `qa-sdk def` commands.

## Non-Goals

- Replacing definition-catalog with PRD JSON.
- Turning PRD JSON into definition frontmatter.
- Starting a REST document management service.
- Remote document mutation, multi-user locking, or tenancy.
- Automatic unreviewed TODO-to-spec promotion.
- New artifact vocabulary for document evidence in this PRD.
- Editing code comments or source annotations outside explicitly scoped source-reference tests.
- Running ralph-tui from the docs control plane.
- Applying metadata transforms to repository files; this PRD only previews change sets.

## Technical Considerations

- Existing definition CLI:
  - `packages/cli/src/commands/def.ts`
  - `packages/cli/src/command-groups/def.commands.ts`
- Existing definition scanners/writers:
  - `packages/definition-catalog/src/frontmatter.ts`
  - `packages/definition-catalog/src/frontmatter-writer.ts`
  - `packages/definition-catalog/src/validate.ts`
  - `packages/definition-catalog/src/assemble.ts`
  - `packages/definition-data-source/src/sync-local-db.ts`
  - `packages/definition-data-source/src/scan-data-source.ts`
- New likely CLI files:
  - `packages/cli/src/commands/docs.ts`
  - `packages/cli/src/commands/docs.test.ts`
  - `packages/cli/src/command-groups/docs.commands.ts`
  - `packages/cli/src/lib/docs-control-plane/*.ts`
- Existing PRD fixtures:
  - `tasks/prd-ontology-registry-cli-scenario-hardening.md`
  - `tasks/prd-ontology-registry-cli-scenario-hardening.json`
- Current known drift fixture:
  - Use a copied fixture of the current `.ralph-tui/session-meta.json` completed-PRD/running-session mismatch. Tests must not read or mutate the live `.ralph-tui/session-meta.json`.

## Success Metrics

- A maintainer can run one command to see document family status and related evidence.
- A maintainer can detect PRD/session/spec/todo drift without manual grep.
- A maintainer can generate PRD authoring context from existing docs before writing a PRD.
- A ralph-compatible PRD JSON can be generated through the docs control plane without schema anti-patterns.
- Batch metadata transforms show safe dry-run previews without mutating files.
- Existing `qa-sdk def validate` remains green.

## Open Questions

- Should `qa-sdk docs prd scaffold` write a full PRD draft or only a context bundle plus skeleton? Default recommendation: skeleton plus context sources first.
- Should `.ralph-tui/session-meta.json` completion cleanup be a docs control-plane command or remain a ralph tracker concern? Default recommendation: drift detection first, mutation later.
[/PRD]
