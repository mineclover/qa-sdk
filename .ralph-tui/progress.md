# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Neutral document control-plane adapters should preserve source-owned vocabulary in plain string fields and normalize only coordination concerns: identity, paths, metadata defaults, and collection defaults.
- Evidence adapters should project source-owned relation fields into neutral metadata/links while keeping default sidecar/registry files optional; missing optional stores should only become diagnostics when the caller explicitly requests evidence-source warnings.
- CLI tests that touch optional `~/.qa-sdk` side stores should set `QA_SDK_HOME` to a temp directory so developer-local ledgers cannot affect hermetic assertions.
- Definition markdown family grouping should use an explicit family id when present, otherwise the repo-relative basename with `.spec.md`/`.todo.md`/`.plan.md`/`.test.md`/`.memo.md`/`.rule.md` stripped; keep each file's `def.id` as metadata so source ownership is not blurred.
- CLI Vitest suites that exercise native SQLite/better-sqlite3 should use the `forks` pool; the default worker pool can segfault during native teardown after assertions pass.
- Docs CLI tests should pass `--root` to a temp workspace and exercise the real default adapters together; this keeps definition markdown, PRD markdown/JSON, session, and evidence aggregation hermetic while still testing command-level behavior.
- Docs drift checks should correlate already-normalized envelopes in the command/control-plane layer and only read source file content for cross-document evidence; adapters stay read-only and source vocabulary stays source-owned.
- Docs metadata transforms should stay as command-layer dry-run projections over parsed source files; adapters remain read-only, rule fields are allowlisted, and projected frontmatter lives in change-set metadata until a later apply story exists.
- PRD authoring workflows should compose markdown from docs control-plane envelopes in the command layer; they must not call ralph-tui or create ralph PRD JSON unless a later explicit adapter command owns that conversion.
- PRD compatibility conversion should compose from source adapters and validate generated target content through the target adapter before writing; adapters remain read-only while the command owns explicit materialization.
- PRD completion sync should remain a command-layer dry-run projection; `passes: true` can identify candidate docs, but TODO/spec promotion must require source/test/evidence links or be reported as a blocked promotion.
- Docs control-plane documentation should split `qa-sdk def` primitives from `qa-sdk docs` cross-document workflows; only explicit `--output` materializers write, while transform/sync projections stay dry-run and PRD JSON stays a ralph compatibility format.

---

## 2026-04-15 - US-001
- Added a local CLI docs control-plane boundary under `packages/cli/src/lib/docs-control-plane/`.
- Defined `DocumentEnvelope`, `DocumentAdapter`, `DocumentTask`, `DocumentEvidence`, `DocumentDiagnostic`, `DocumentChangeSet`, related source/link/section types, normalization helpers, and adapter capability declaration helpers.
- Documented in code comments and module README that repository files remain SSOT and the control plane is only an index/coordination layer; no REST, remote service, migration, or artifact vocabulary was added.
- Added unit tests for envelope normalization and adapter capability defaults/explicit declarations.
- Hardened existing def tests and optional review-feedback lookup so local review-ledger state does not break doc queries.
- Fixed existing definition-catalog frontmatter regressions blocking the required validation gates: duplicate document id, invalid lifecycle/scope pair, and missing performance concern tag.
- Files changed: `packages/cli/src/lib/docs-control-plane/*`, `packages/cli/src/commands/def.test.ts`, `packages/definition-data-source/src/review-feedback-source.ts`, `docs/specs/system/document-addressing-contract.plan.md`, `docs/specs/rlsc/rlsc-text-occupancy.todo.md`, `docs/specs/weighted-index-system/wi-hardware-acceleration.spec.md`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`. Extra local rebuilds: `pnpm --filter definition-catalog build`; `pnpm --filter definition-data-source build`.
- **Learnings:**
  - CLI support modules can live cleanly under `packages/cli/src/lib/<feature>/` with local `index.ts`, focused tests, and a README when the feature is a boundary contract rather than a CLI command.
  - `@qa-sdk/cli` tests resolve workspace library packages through built package output in some paths, so source-only dependency changes may need dependency rebuilds before a CLI bundle reflects them.
  - Definition real-doc gates are strict about unique `def.id`, allowed scope/aspect pairs, valid lifecycle values, and concern tags inferred from filenames.
---

## 2026-04-15 - US-002
- Implemented a read-only `definition-markdown` docs control-plane adapter that reuses `definition-catalog` frontmatter scanning/parsing, marker summary extraction, source reference parsing, and graph validation.
- The adapter collects definition frontmatter metadata, source paths, source refs, links, purpose/overview sections, and validation diagnostics into neutral `DocumentEnvelope`s while preserving source vocabulary.
- Added basename family grouping for `.spec.md`, `.todo.md`, `.plan.md`, `.test.md`, `.memo.md`, and `.rule.md`; explicit family ids are honored when present.
- Added temporary-doc tests for frontmatter extraction, spec/todo/plan family detection, and group/module/leaf level diagnostics.
- Files changed: `packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts`, `packages/cli/src/lib/docs-control-plane/index.ts`, `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`, `packages/cli/src/lib/docs-control-plane/README.md`, `packages/definition-catalog/src/code-references.ts`, `packages/definition-catalog/src/index.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter definition-catalog build`; `pnpm --filter @qa-sdk/cli test -- docs-control-plane`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-data-source typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `definition-catalog` already had a source/sources frontmatter extractor for code-link coverage; exporting it avoids a second parser in the control-plane adapter.
  - `scanAndBuild` remains the compatibility source for registry ordering, duplicate spec/todo coexistence, and validation, but family-member envelopes need a second parse pass so skipped TODO/plan companion files are still visible to docs control-plane consumers.
  - The `def` CLI suite can occasionally segfault after all assertions pass due to native teardown; rerunning the exact command produced the normal passing summary.
---

## 2026-04-15 - US-003
- Implemented read-only `prd-markdown`, `ralph-prd-json`, and `ralph-session` docs control-plane adapters.
- `prd-markdown` reads `[PRD]...[/PRD]` blocks, overview, goals, quality gates, user stories, acceptance criteria, functional requirements, non-goals, and open questions into neutral sections/tasks.
- `ralph-prd-json` validates the flat ralph root shape, reports schema anti-patterns as diagnostics, and maps `userStories[]` to control-plane tasks with `passes`, `dependsOn`, notes, completion notes, acceptance criteria, and extracted quality gates.
- `ralph-session` reads `.ralph-tui/session-meta.json` and reports drift when a linked PRD JSON is complete but the session is running, or when session task counts disagree with PRD story/pass counts.
- Pinned the CLI Vitest pool to `forks` so native SQLite teardown no longer segfaults after the `def` assertions pass.
- Files changed: `packages/cli/src/lib/docs-control-plane/adapters/prd-markdown.ts`, `packages/cli/src/lib/docs-control-plane/adapters/ralph-prd-json.ts`, `packages/cli/src/lib/docs-control-plane/adapters/ralph-session.ts`, `packages/cli/src/lib/docs-control-plane/query.ts`, `packages/cli/src/lib/docs-control-plane/index.ts`, `packages/cli/src/lib/docs-control-plane/README.md`, `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`, `packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts`, `packages/cli/vitest.config.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs-control-plane`; `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - PRD markdown can stay adapter-local: headings become neutral sections, while story-specific fields stay in task metadata so the markdown remains the source-owned schema.
  - Ralph PRD JSON should treat `dependsOn: []` as meaningful explicit state; missing `dependsOn` is a schema-quality diagnostic because dependency absence and dependency omission are different coordination signals.
  - Session/PRD completion mismatch belongs in diagnostics on the session envelope, not in a cleanup mutation of `.ralph-tui/session-meta.json`.
  - `definition-data-source` currently has no `test` script; the requested pnpm test command exits successfully without package-local test output.
---

## 2026-04-15 - US-004
- Implemented the read-only `artifact-evidence` docs control-plane adapter for local programming artifact registry JSON files in array and `{ artifacts: [...] }` forms.
- The adapter maps each registry record into a neutral envelope with artifact id/kind/ref/output path, produced-by, derived-from, verifies, owner definition, materializes-output, source refs, verification refs, source metadata, relation links, and a `DocumentEvidence` entry that preserves `activation-evidence` as source-owned vocabulary.
- Added adapter-level filtering for document id, artifact ref, output path, pack id, and artifact kind, plus opt-in missing registry source diagnostics via `warnOnMissing`.
- Added tests covering activation-evidence records built by the ontology activation evidence mapper, filtering, array-form registries, and silent default missing registry behavior.
- Files changed: `packages/cli/src/lib/docs-control-plane/adapters/artifact-evidence.ts`, `packages/cli/src/lib/docs-control-plane/index.ts`, `packages/cli/src/lib/docs-control-plane/README.md`, `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs-control-plane`; `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Artifact registry records already carry the right source-owned vocabulary, so the control-plane adapter can preserve field names in metadata and only use `DocumentLink` for existing relation edges.
  - `activation-evidence` should remain a programming artifact kind in `DocumentEvidence.kind`; the adapter does not need a new docs evidence taxonomy to make activation proof reviewable.
  - Default evidence registry paths should be safe to include in future docs status collection because missing files stay silent unless `warnOnMissing` is explicitly enabled.
---

## 2026-04-15 - US-005
- Added the `qa-sdk docs` command group alongside the existing `qa-sdk def` surface and registered it through the shared command tree/handler registry in `packages/cli/src/index.ts`.
- Implemented `qa-sdk docs status`, `qa-sdk docs collect`, and `qa-sdk docs search` over the docs control-plane adapters, including text/JSON output, kind and metadata search filters, related-family collection, artifact evidence association, and next follow-up detection from ralph session drift, PRD task state, and todo family members.
- Added CLI tests for text and JSON output using temp-root fixtures that include definition markdown, PRD markdown, ralph PRD JSON, ralph session metadata, and artifact evidence.
- Added root usage/help/dispatch tests proving `qa-sdk docs` routes through the same command registry pattern as other tree groups.
- Files changed: `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts`, `packages/cli/src/index.ts`, `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/commands/index-usage.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- index-usage`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `docs` can reuse the same proxy-style handler registry as `def`, but command behavior belongs in a separate router because `docs` aggregates multiple adapters instead of delegating to one package-specific CLI.
  - Family collection needs both family-id matching and identity/path relation matching so source-owned artifact evidence with `ownerDefinitionId` can appear beside a definition markdown family.
  - For shared stable ids like `tasks/foo` across PRD markdown and ralph PRD JSON, CLI target resolution should prefer source authoring documents before compatibility/session/evidence adapters.
---

## 2026-04-15 - US-006
- Implemented `qa-sdk docs drift [--prd <file>] [--json]` in the docs command group with text and JSON outputs grouped by severity and remediation hints.
- Added drift detection for completed PRD JSON with running ralph sessions, completed PRD JSON with unchecked PRD markdown criteria, open TODO checkboxes described as complete in related specs/PRD notes, scenario matrix `E-*` references with stale test titles, missing document source-reference files, and definition level/contains violations through existing definition validation diagnostics.
- Added hermetic CLI fixtures using the docs control-plane PRD/session pattern, including temp-root PRD markdown/JSON, ralph session metadata, definition docs, scenario matrix evidence references, and source-reference drift.
- Files changed: `packages/cli/src/lib/docs-control-plane/drift.ts`, `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts`, `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/commands/index-usage.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- index-usage`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Drift belongs above the adapters: adapter diagnostics and metadata provide most signals, while command-layer correlation can compare PRD families, TODO language, scenario matrix evidence, and source file existence without changing source schemas.
  - Scenario matrix evidence is stable enough to validate by pairing each `E-*` marker with an Evidence References entry and exact test title lookup in the linked test file.
  - PRD-scoped drift should use the shared markdown/JSON basename family id so `tasks/foo.md`, `tasks/foo.json`, and `.ralph-tui/session-meta.json` can be checked together without scanning unrelated definition families.
---

## 2026-04-15 - US-007
- Implemented `qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run] [--json]` with dry-run as the default and no write path.
- Added a CLI-local metadata transform planner that reads definition markdown through structured frontmatter parsing, applies allowlisted lifecycle, level, tag, link, `svc`, and source-reference operations, and returns before/after change-set previews with affected paths.
- Added structured unsupported-operation handling for `--apply`, with remediation pointing to a later apply PRD.
- Added refusals for non-definition sources such as PRD JSON and for rules that attempt to touch `def.id`.
- Added CLI tests for default dry-run no-write behavior, explicit dry-run text output, unsupported `--apply`, PRD JSON refusal, and protected `def.id` handling.
- Files changed: `packages/cli/src/lib/docs-control-plane/metadata-transform.ts`, `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts`, `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/commands/index-usage.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- index-usage`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Metadata transform planning belongs above the adapters: use neutral envelopes for target resolution, then read the source file only for the structured projected frontmatter.
  - Source references are top-level definition markdown metadata, not `def.*`; previews should report them alongside `def` metadata while keeping PRD JSON as a compatibility source that cannot be converted into definition frontmatter.
  - Multi-segment docs command descriptors need the proxy registry to split handler keys like `docs.transform.metadata` back into CLI path segments.
---

## 2026-04-15 - US-008
- Implemented `qa-sdk docs prd context <topic|doc-id> [--json]` to collect PRD authoring context from existing docs control-plane adapters.
- Context collection now surfaces related specs, open TODOs, plans, prior markdown PRDs, ralph PRD JSON completion state, ralph session state, scenario matrix rows, document sources, evidence, diagnostics, and context source reasons.
- Implemented `qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]` to write a markdown PRD skeleton grounded in the collected context.
- The scaffold includes overview, goals, quality gates, user story placeholders, non-goals, technical considerations, success metrics, open questions, and a Control-Plane Context Sources section.
- Scaffold output refuses `.json` paths so PRD authoring does not create ralph PRD JSON, and it does not call `ralph-tui`.
- Extended PRD markdown parsing metadata for technical considerations, success metrics, and control-plane context source sections.
- Files changed: `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts`, `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/commands/index-usage.test.ts`, `packages/cli/src/lib/docs-control-plane/adapters/prd-markdown.ts`, `packages/cli/src/lib/docs-control-plane/README.md`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- index-usage`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - PRD context composition belongs above adapters because it correlates normalized envelopes, topic matches, markdown TODO rows, scenario matrix tables, evidence, and ralph state without changing source-owned schemas.
  - Scaffold generation should be markdown-only at this layer; `.json` output would blur authoring with the ralph adapter conversion boundary.
  - PRD markdown adapter parsing can safely recognize new scaffold sections as source-owned PRD markdown metadata while keeping the control plane read-only.
---

## 2026-04-15 - US-009
- Implemented `qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]`.
- Conversion reads PRD markdown through the `prd-markdown` adapter, builds flat ralph-compatible root JSON with `name`, `branchName`, `description`, and `userStories`, appends PRD quality gates to every story, derives dependencies from story order or explicit prerequisite hints, sets generated stories to `passes: false`, keeps `notes` empty, and omits story `status`.
- Generated content is validated through the ralph PRD JSON adapter before the command writes the output file.
- Added CLI and adapter tests covering prerequisite metadata, conversion output shape, quality gate propagation, dependency derivation, no-status stories, and rereading the generated JSON through the ralph adapter.
- Files changed: `packages/cli/src/lib/docs-control-plane/adapters/prd-markdown.ts`, `packages/cli/src/lib/docs-control-plane/adapters/ralph-prd-json.ts`, `packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts`, `packages/cli/src/lib/docs-control-plane/index.ts`, `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts`, `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/commands/index-usage.test.ts`, `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- index-usage`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - PRD-to-ralph conversion belongs in the command layer: source adapters provide neutral envelopes, the command owns materialization, and the target adapter validates the generated compatibility shape before write.
  - Explicit prerequisite hints should stay as PRD markdown task metadata; conversion can then preserve source-owned hints while using story order as the default dependency fallback.
  - Validating generated JSON from content avoids a temp output write and keeps the ralph adapter read-only.
---

## 2026-04-15 - US-010
- Implemented `qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--json]`.
- Added a read-only completion sync planner that summarizes completed PRD stories, affected docs, open TODO candidates, spec update candidates, roadmap/plan candidates, scenario matrix candidates, session drift, diagnostics, and blocked promotions.
- Completion sync remains dry-run only, refuses `--apply`, and does not mutate PRD JSON or definition markdown files.
- TODO/spec promotion candidates require source/test/evidence links from related docs, story references, or artifact evidence; candidates without evidence are surfaced as blocked instead of promoted from `passes: true` alone.
- Added CLI/help tests with a completed ralph PRD JSON fixture and a mismatched TODO/spec fixture without evidence.
- Files changed: `packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts`, `packages/cli/src/lib/docs-control-plane/index.ts`, `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts`, `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/commands/index-usage.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- index-usage`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Completion sync belongs above adapters: it correlates normalized envelopes, PRD story state, definition families, artifact evidence, scenario matrix rows, and session diagnostics without changing source schemas.
  - `passes: true` should be treated as a candidate signal, not a documentation authority; evidence-linked candidates and blocked promotions need separate states in the dry-run output.
  - Plan/roadmap and scenario matrix refreshes can be proposed from topic/family matches while still leaving all file writes to a future explicit apply story.
---

## 2026-04-15 - US-011
- Added `docs-control-plane` as an approved definition-catalog spec that records the docs control-plane architecture, read-only adapter boundary, source-of-truth direction, PRD JSON compatibility role, dry-run-first policy, transform allowlist, PRD command selection, and explicit out-of-scope items.
- Linked the new spec from `definition-catalog-spec` and added it to the parent module overview and operating entrypoints.
- Updated the definition authoring guide to distinguish `qa-sdk def` primitives from `qa-sdk docs` cross-document workflows, including `docs prd context`, `docs prd scaffold`, `docs prd to-ralph-json`, metadata transform limits, and dry-run completion sync behavior.
- Updated the ralph workflow guide and CLI docs-control-plane README so PRD JSON is documented as a ralph compatibility format rather than the core document model.
- Files changed: `docs/specs/definition-catalog/docs-control-plane.spec.md`, `docs/specs/definition-catalog/definition-catalog.spec.md`, `docs/specs/guides-system/definition-authoring-guide.md`, `docs/skills/ralph-tui-workflows.md`, `packages/cli/src/lib/docs-control-plane/README.md`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- docs`; `pnpm --filter @qa-sdk/cli test -- def`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter definition-catalog test`; `pnpm --filter definition-catalog typecheck`; `pnpm --filter definition-data-source test`; `pnpm --filter definition-data-source typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Public docs need the same source boundary as the code: adapters read and preserve source-owned vocabulary, while command-layer workflows own correlation, dry-run projections, and explicit materialization.
  - PRD JSON should be described as an execution compatibility artifact everywhere it appears; otherwise future agents may treat ralph state as the authoring model and reintroduce PRD-centric drift.
  - `def validate --scan` and `def scan-audit` can surface existing broad graph cycles even when the required local `def validate` gate passes cleanly.
---
