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
