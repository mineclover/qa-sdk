# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Canonical spec documents live under `docs/specs/...`; package-local `packages/*/specs/README.md` files are index pages that point to the centralized docs. If a package spec file appears missing, update the central doc instead of restoring duplicate copies.
- For spec-alignment stories, centralized docs can intentionally describe the approved snake_case refactor target even when the current implementation still uses equivalent camelCase identifiers; treat the PRD acceptance criteria as the canonical contract.
- New shared `@qa-sdk/core` port specs should be added under `docs/specs/data-model/`, while adapter-specific persistence notes stay in `docs/specs/storage/adapters.spec.md`.
- Config modules that export `env = parseEnv(process.env)` at module scope must be tested via dynamic import after `vi.stubEnv(...)`, with `vi.resetModules()` in cleanup so module-level parsing re-evaluates against the stubbed environment.
- For verdict refactors, thread constraint-level detail end to end: `evaluateConstraints()` returns `ConstraintResult[]`, `matchGraphs()` stores that on `StepMatch.constraint_results`, and missing or unconstrained steps use `[]` instead of synthetic reason strings.
- Verdict boundaries in this repo keep wrapper DTOs camelCase (`scenarioId`, `overallVerdict`, `computedAt`) while the nested `report` payload remains the canonical snake_case `VerdictReport`; verify or refactor at the embedded `report` shape boundary instead of renaming the outer store/API envelopes.
- Graph pipeline refactors treat `SpecNode` as an engine-local projection: `compileSpec()` copies only the fields needed by matching/verdict, while matcher/verdict fixtures should build lightweight `SpecNode` objects directly instead of nesting full `ScenarioStep` payloads.
- Workspace packages in this repo resolve sibling dependencies through their exported `dist` artifacts during consumer-package tests, so after cross-package refactors you need to rebuild the changed dependency packages before verifying downstream packages like `ingest-server`.
- Package-level acceptance checks that invoke `pnpm --filter <pkg> run typecheck` require an explicit `typecheck` script in that package's `package.json`, even when `build` already runs `tsc`.
- Pure data packages like `event-catalog` are easiest to regression-test with a single `src`-local Vitest suite that asserts canonical counts, key sets, and exported map/predicate behavior directly against the package registries.
- When a workspace shim needs a canonical internal package name but must preserve a third-party-compatible import like `import pino from "pino"`, keep consumers on the public import ID via a dependency alias such as `"pino": "workspace:@qa-sdk/pino@^9.9.4"`.

---

## 2026-03-13 - US-001
- What was implemented
  - Updated the canonical core data-model specs for record, graph, verdict, and utils to match the target design in US-001.
  - Rewrote graph/verdict specs around snake_case fields, lightweight `SpecNode`, `source`/`target` edges, `causal` runtime edges, `StepMatch.constraint_results`, and `VerdictStore` lookup/removal requirements.
  - Added record payload enum expansions, `_registry_warning`, and the new ID utilities `newVerdictId()` / `newDlqId()`.
- Files changed
  - `docs/specs/data-model/record.spec.md`
  - `docs/specs/data-model/graph.spec.md`
  - `docs/specs/data-model/verdict.spec.md`
  - `docs/specs/data-model/utils.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - The core package spec paths referenced in tasks are currently served through centralized docs, so `packages/core/specs/README.md` is the right handoff point for locating the canonical files.
  - Gotchas encountered
    - Current `packages/core/src/types/*` and port signatures still lag parts of the US-001 target design, so the spec update had to follow the PRD acceptance criteria rather than mirroring the existing implementation one-to-one.
---

## 2026-03-13 - US-002
- What was implemented
  - Rewrote the canonical engine pipeline spec in `docs/specs/pipeline/pipeline.spec.md` to reflect the approved target signatures for reconstruction, matching, verdict computation, and internal orchestration helpers.
  - Documented `reconstruct(trace_id, records, options)`, `ReconstructionOptions.temporal_strategy`, `evaluateConstraints(): ConstraintResult[]`, `computeVerdict(match_result, spec_graph, runtime_graph, qa_session_id?)`, and the internal helpers `reconstructTrace()` / `computeTraceVerdict()`.
- Files changed
  - `docs/specs/pipeline/pipeline.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Pipeline/spec alignment tasks in this repo use the centralized spec docs to lock in the refactor target API, even when the current engine source still exposes equivalent camelCase names.
  - Gotchas encountered
    - The existing engine implementation still returns `boolean` from `evaluateConstraints()` and uses camelCase option names, so the spec had to follow the approved target contract rather than the current source verbatim.
---

## 2026-03-13 - US-003
- What was implemented
  - Expanded the canonical `QaLogger` spec with explicit `LogParams`, `SpanParams`, and `SpanHandle.end()` parameter contracts.
  - Added new centralized core specs for `ScenarioSpecStore` and `DlqStore`, including the public types and method behaviors required by the current ports.
  - Updated the centralized spec index plus the `@qa-sdk/sdk` and `@qa-sdk/core` package-local spec README indexes.
- Files changed
  - `docs/specs/collection/logger.spec.md`
  - `docs/specs/data-model/scenario-spec-store.spec.md`
  - `docs/specs/data-model/dlq-store.spec.md`
  - `docs/specs/README.md`
  - `packages/sdk/specs/README.md`
  - `packages/core/specs/README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Missing shared-port docs should be introduced as standalone centralized specs and then linked from both `docs/specs/README.md` and the owning package's `specs/README.md`.
  - Gotchas encountered
    - `ScenarioSpecStore` consumes the snake_case `ScenarioSpec` type, but `DlqStore` and several storage-facing DTOs still use camelCase field names, so the new specs had to mirror each contract individually instead of normalizing all names.
---

## 2026-03-13 - US-004
- What was implemented
  - Updated the in-memory session and trace store tests to verify persisted state through `findById()` after `upsert()`, matching the `Promise<void>` store contract.
  - Fixed the registry-server env test by stubbing `DATABASE_URL` before dynamically importing the config module, so the module-level `parseEnv(process.env)` evaluation succeeds during the test.
- Files changed
  - `packages/store/src/adapters/memory/session.adapter.test.ts`
  - `packages/store/src/adapters/memory/trace.adapter.test.ts`
  - `packages/registry-server/src/__tests__/config/env.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Store adapter tests in this repo should treat `upsert()` as a command operation and read back persisted state with `findById()` when asserting results.
  - Gotchas encountered
    - `packages/registry-server/src/config/env.ts` parses `process.env` at import time, so tests must stub required env vars before the dynamic import instead of only passing a custom object to `parseEnv()`.
---

## 2026-03-13 - US-005
- What was implemented
  - Replaced `StepMatch.reason` with shared `ConstraintResult[]` details and reshaped `VerdictReport` to expose canonical `step_matches`, `summary`, and `computed_at`.
  - Updated the engine constraint evaluator, graph matcher, and verdict computation to carry constraint-level results through matching and derive the final verdict from `step_matches`.
  - Rewrote the engine matcher, verdict, and pipeline tests to assert `constraint_results`, `step_matches`, and the new summary/computed timestamp behavior.
- Files changed
  - `packages/core/src/types/verdict.ts`
  - `packages/core/src/index.ts`
  - `packages/engine/src/matching/constraint-evaluator.ts`
  - `packages/engine/src/matching/graph-matcher.ts`
  - `packages/engine/src/verdict/compute.ts`
  - `packages/engine/src/matching/constraint-evaluator.test.ts`
  - `packages/engine/src/matching/graph-matcher.test.ts`
  - `packages/engine/src/verdict/compute.test.ts`
  - `packages/engine/test/pipeline.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Engine verdict fixtures are easiest to keep aligned by treating `MatchResult.step_matches` as the single source of truth in tests and deriving pass/fail/warn expectations from filtered `step_matches`.
  - Gotchas encountered
    - `@qa-sdk/core` does not currently define a `typecheck` script, so the acceptance check had to use `pnpm --filter @qa-sdk/core exec tsc --noEmit -p tsconfig.json` instead of `pnpm --filter @qa-sdk/core run typecheck`.
---

## 2026-03-13 - US-006
- What was implemented
  - Verified the existing memory and drizzle verdict adapters already persist and return the new nested `VerdictReport` shape through the `report` JSON field.
  - Verified the ingest-server verdict query routes return that stored `report` payload unchanged and the recompute route still works with the refactored verdict pipeline.
  - Confirmed the package-level acceptance checks pass without additional code changes.
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Verdict refactor verification should focus on the nested `report` payload shape, because the outer storage and route DTOs intentionally remain camelCase for compatibility.
  - Gotchas encountered
    - The `store` package skips drizzle integration tests when `DATABASE_URL` is absent, so story verification for this iteration relied on the passing memory-adapter suite plus typechecks unless a test database is configured.
---

## 2026-03-13 - US-007
- What was implemented
  - Refactored `@qa-sdk/core` graph types to the canonical `source`/`target` edge fields, renamed the runtime edge union from `derived` to `causal`, and replaced heavyweight `SpecNode.step` references with the lightweight projected `SpecNode` shape.
  - Updated engine `compileSpec()`, graph matching, reconstruction, and verdict computation to consume the projected node fields directly and to use `specNode.timeout_ms` for latency checks.
  - Rewrote the affected engine tests to assert the new `SpecNode` projection and `source`/`target` edge endpoints, and added a `core` `typecheck` script so the requested acceptance command runs directly.
- Files changed
  - `packages/core/package.json`
  - `packages/core/src/types/graph.ts`
  - `packages/engine/src/spec-compiler/compile.ts`
  - `packages/engine/src/spec-compiler/compile.test.ts`
  - `packages/engine/src/matching/graph-matcher.ts`
  - `packages/engine/src/matching/graph-matcher.test.ts`
  - `packages/engine/src/reconstruction/edge-factory.ts`
  - `packages/engine/src/reconstruction/span-tree-builder.ts`
  - `packages/engine/src/reconstruction/reconstruct.ts`
  - `packages/engine/src/reconstruction/reconstruct.test.ts`
  - `packages/engine/src/verdict/compute.ts`
  - `packages/engine/src/verdict/compute.test.ts`
  - `packages/engine/test/pipeline.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Graph-model alignment is easiest to keep stable when `compileSpec()` is the only place that knows about `ScenarioStep`; downstream matcher/verdict code and tests should operate on projected `SpecNode` fields only.
  - Gotchas encountered
    - The requested `pnpm --filter @qa-sdk/core run typecheck` acceptance check was not runnable until `packages/core/package.json` exposed a dedicated `typecheck` script, even though the package already had a valid `tsconfig.json`.
---

## 2026-03-13 - US-008
- What was implemented
  - Updated the store graph fixtures and drizzle graph typing to use the canonical `RuntimeGraph` edge shape with `source` / `target`, while keeping the existing `runtime_graphs.graph` JSONB column unchanged.
  - Verified the ingest-server graph query route now returns the rebuilt canonical runtime graph payload, and updated the route-facing app/E2E fixtures to assert `source` / `target` edges.
  - Rebuilt `@qa-sdk/core`, `@qa-sdk/engine`, and `@qa-sdk/store` so downstream package tests exercised the current exported graph runtime instead of stale `dist` artifacts.
  - Aligned stale `VerdictReport` test fixtures in `store` and `ingest-server` with the current `step_matches` / `computed_at` contract so package builds stayed clean during verification.
- Files changed
  - `packages/store/src/db/schema.ts`
  - `packages/store/src/adapters/drizzle/graph.adapter.ts`
  - `packages/store/src/adapters/drizzle/adapters.integration.test.ts`
  - `packages/store/src/adapters/memory/graph.adapter.test.ts`
  - `packages/store/src/adapters/memory/verdict.adapter.test.ts`
  - `packages/ingest-server/src/app.test.ts`
  - `packages/ingest-server/src/sdk-to-ingest.e2e.test.ts`
  - `packages/ingest-server/src/lib/cleanup.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Consumer-package verification in this workspace must be done against rebuilt dependency `dist` outputs; otherwise downstream tests can keep executing pre-refactor runtime code even when the source packages were already updated.
  - Gotchas encountered
    - No drizzle migration was necessary for US-008 because the persistence layer already stores runtime graphs in a generic `jsonb` column; the change was the JSON payload shape and TypeScript typing, not the table schema.
---

## 2026-03-13 - US-009
- What was implemented
  - Added `GraphRole` and `GraphHint` to `@qa-sdk/event-catalog`, extended `CoreEventDef` with the required `graph_hint` field, and exported the new types from the package entrypoint.
  - Populated `graph_hint` metadata for all 60 core events across the 8 category files using the `graph-hint.spec.md` mapping table.
  - Marked the graph-hint spec as implemented, updated the central specs index status, corrected the spec summary counts to match the implemented event data, and added a package-level `typecheck` script so the requested acceptance command runs directly.
- Files changed
  - `packages/event-catalog/package.json`
  - `packages/event-catalog/src/types.ts`
  - `packages/event-catalog/src/index.ts`
  - `packages/event-catalog/src/categories/navigation.ts`
  - `packages/event-catalog/src/categories/interaction.ts`
  - `packages/event-catalog/src/categories/form.ts`
  - `packages/event-catalog/src/categories/session.ts`
  - `packages/event-catalog/src/categories/network.ts`
  - `packages/event-catalog/src/categories/execution.ts`
  - `packages/event-catalog/src/categories/outcome.ts`
  - `packages/event-catalog/src/categories/quality.ts`
  - `docs/specs/event-vocabulary/graph-hint.spec.md`
  - `docs/specs/README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Package-level acceptance commands in this workspace often assume a `typecheck` script exists on the target package, so adding new package checks may require exposing `tsc --noEmit` explicitly even when `build` already compiles.
  - Gotchas encountered
    - The per-event graph-hint mapping table was internally consistent, but the draft spec's summary counts were stale; the implementation followed the event-level mapping and then reconciled the summary totals to the actual 60-event dataset.
---

## 2026-03-13 - US-010
- What was implemented
  - Added package-level Vitest support for `@qa-sdk/event-catalog` with a `test` script and `vitest.config.ts`.
  - Added a registry integrity test suite covering all 60 core events, the per-category counts, the 20-event v1 minimal set, `coreEventMap` lookups, `isCoreEvent` / `isV1MinimalEvent`, payload guide presence with required-field assertions, and graph-hint validity including the exact 4 goal-eligible events.
  - Verified `pnpm --filter @qa-sdk/event-catalog run typecheck`, `build`, and `test` all pass.
- Files changed
  - `packages/event-catalog/package.json`
  - `packages/event-catalog/vitest.config.ts`
  - `packages/event-catalog/src/index.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Exported const registries in pure data packages are stable enough to test as the contract directly, so a single suite can cover counts, key membership, and derived lookup helpers without bespoke fixtures.
  - Gotchas encountered
    - `@qa-sdk/event-catalog` does not expose a package-level lint script, so the runnable acceptance checks for this story were `typecheck`, `build`, and `test`.
---

## 2026-03-13 - US-011
- What was implemented
  - Renamed the logger package to the canonical `@qa-sdk/pino` identity, added a package-level `typecheck` script, and introduced `vitest.config.ts` so `pnpm --filter @qa-sdk/pino run test` is a first-class acceptance command.
  - Added a focused `src/index.test.ts` suite covering level filtering, structured JSON output with `level` / `time` / `msg`, child logger binding inheritance and merge behavior, `Error` serialization, and `silent` mode suppression.
  - Updated the logger implementation to emit a default numeric `time` field on every log record and aligned workspace dependency aliases plus lockfile specifiers so consumers can keep importing `pino`.
- Files changed
  - `packages/pino/package.json`
  - `packages/pino/vitest.config.ts`
  - `packages/pino/src/index.ts`
  - `packages/pino/src/index.test.ts`
  - `packages/registry-client/package.json`
  - `packages/registry-server/package.json`
  - `packages/ingest-server/package.json`
  - `pnpm-lock.yaml`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Compatibility shims that intentionally mirror third-party import IDs can still use a canonical workspace package name by switching consumers to a `workspace:` alias instead of renaming every `import`.
  - Gotchas encountered
    - `pnpm install --lockfile-only` could not refresh the lockfile in this sandbox because pnpm tried to create store symlinks outside the writable scope, so the importer specifiers had to be updated manually in `pnpm-lock.yaml`.
---
