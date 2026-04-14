# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- CLI command discovery lives in `packages/cli/src/command-groups/*.commands.ts`; ontology descriptors are proxied by handler key into `cliOntology` in `packages/cli/src/commands/ontology.ts`.
- Local ontology activation should use one SQLite driver for registry-service ontology rows and index-meta rows: apply registry-service/index-meta schema setup, then share the driver across `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, and `SqlIndexMetaStore`.
- CLI-local ontology pack sources should resolve through a pure result-union helper in `packages/cli/src/lib`, importing production pack exports only; SQLite/store activation wiring stays outside the resolver so unit tests remain store-free.
- Local ontology activation runtime is exported from `@qa-sdk/registry-service/ontology-local-runtime`; it returns a closeable runtime over one SQLite driver and supports both `:memory:` and persistent `--store`-style paths.
- Packaged registry-service runtime code must resolve Drizzle migrations from both source and bundled `dist` locations; bundled files run with `import.meta.url` under `dist`, so source-relative `../../drizzle` can accidentally select sibling workspace folders like `packages/drizzle`.
- Activation CLI JSON should print helper results unwrapped; pre-helper CLI/runtime failures should use a result-like failed payload with sanitized errors so automation can parse one stable contract.
- CLI tests that need to prove command discovery/dispatch should invoke `main(["ontology", ...])`; `cliOntology(["registry.activate-pack", ...])` only proves the handler surface after proxy resolution.
- Activation JSON represents ontology taxonomies in `allocationSummaries`; synced axis coverage is proven through `syncReports[*].materializedRecords[*].axisId` because `syncSummariesByAllocationId` intentionally stays count-only.
- CLI-origin ontology activation text failures should preserve the stable JSON error code as a `<code>: <message>` prefix; helper-returned lifecycle failures should continue through the activation summary `errors` list.
- Activation CLI `--output` should be a sidecar materialization of the same pretty JSON payload printed by `--json`; keep `--json` stdout unchanged, create parent directories before writing, and do not append programming artifact registry records unless a later story explicitly adds that registry integration.
- New definition-catalog CLI surfaces should get a dedicated `aspect: cli_contract` leaf and be added to the owning `*-system` document with a `contains` link so command contracts do not get buried in lifecycle specs.

---

## 2026-04-15 - US-001
- Documented the activation CLI boundary in `operational-ontology-registry-allocation.spec.md`: Phase 5 remains the completed internal lifecycle, while `qa-sdk ontology registry activate-pack <pack-id>` is only an optional local/public execution surface.
- Identified supported initial pack ids and import contracts: `programming-artifact-ontology` from `operational-ontology/programming-artifacts` and `authorization-ontology` from `authorization-ontology`.
- Added `authorization-ontology` as a direct `@qa-sdk/cli` workspace dependency for the later known-pack resolver.
- Confirmed the command path and flags for later implementation without adding the command descriptor or handler in this story.
- Documented the intended local SQLite runtime strategy: use registry-service/index-meta SQL infrastructure over one driver, no Nest HTTP server, no REST calls, no new persistence abstraction, no raw SQL in CLI command code.
- Files changed: `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`, `packages/cli/package.json`, `pnpm-lock.yaml`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `programmingArtifactOntologyPack` is already exported by the `operational-ontology/programming-artifacts` subpath and covered by the existing CLI dependency.
  - `authorizationOntologyPack` is exported from the root `authorization-ontology` package, so the CLI needs a direct workspace dependency before a resolver imports it.
  - The existing ontology command registry already has the right dispatch shape; future command work should add only a descriptor plus `cliOntology` handling.
  - `createRegistryDatabaseDriver()` applies registry-service migrations over the index-meta SQLite driver setup, but `createRegistryStores()` does not expose the shared driver needed to also build `SqlIndexMetaStore` for activation sync.
---

## 2026-04-15 - US-002
- Added a CLI-local known ontology pack resolver for `programming-artifact-ontology` and `authorization-ontology`.
- Unknown pack ids now resolve to a structured `unknown-ontology-pack` error payload with the requested id, message, and supported pack ids.
- Added resolver unit coverage in the ontology CLI test suite without constructing SQLite stores or importing test fixtures.
- Files changed: `packages/cli/src/lib/known-ontology-packs.ts`, `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - The resolver should stay independent from the future activation runtime: it only maps stable ids to `OperationalOntologyPack` values and returns a result union.
  - `programmingArtifactOntologyPack` and `authorizationOntologyPack` are production exports, so resolver tests can validate pack ids without fixture imports.
  - After US-001 added `authorization-ontology` as a CLI dependency, stale local workspace links can make Vitest unable to resolve it until `pnpm install --offline` refreshes node_modules.
---

## 2026-04-15 - US-003
- Added a local ontology activation runtime that constructs `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, `SqlIndexMetaStore`, sync adapter, registry service, and activation helper over a single registry-service SQLite driver.
- Supported persistent local SQLite state by normalizing non-`:memory:` store paths to absolute paths and creating parent directories before opening SQLite.
- Added an in-memory test runtime path via `:memory:` while still using the SQL-backed registry-service/index-meta APIs.
- Exported the runtime through `@qa-sdk/registry-service/ontology-local-runtime` and included the subpath in the registry-service build output.
- Added registry-service tests proving activation through the helper and persistence across reopening the same SQLite store.
- Files changed: `packages/registry-service/src/modules/ontology/local-activation-runtime.ts`, `packages/registry-service/src/modules/ontology/local-activation-runtime.test.ts`, `packages/registry-service/src/ontology-local-runtime.ts`, `packages/registry-service/src/index.ts`, `packages/registry-service/package.json`, `packages/registry-service/tsup.config.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `createRegistryStores(":memory:")` intentionally returns in-memory stores, so local activation uses `createRegistryDatabaseDriver()` directly to keep registry-service and index-meta rows on the same SQLite driver.
  - The local runtime can stay below the CLI command layer: US-004 can pass `--store` into `createLocalOntologyActivationRuntime()` without duplicating store construction or starting Nest.
  - `tsup` needed explicit `index` and `ontology-local-runtime` entries plus declarations so the package export subpath has concrete JS and type output.
---

## 2026-04-15 - US-004
- Added the `qa-sdk ontology registry activate-pack <pack-id>` command descriptor under the ontology command group and routed it through the existing `cliOntology` handler proxy as `registry.activate-pack`.
- Implemented the CLI handler to resolve known packs, parse activation flags, support repeatable deterministic `--prefix <taxonomyId>=<prefix>` overrides, create the local registry-service runtime, call `OntologyPackActivationHelper.activateOntologyPack()`, emit JSON or concise text output, and close the runtime driver.
- Added `@qa-sdk/registry-service` as a CLI workspace dependency so the command can import the exported `ontology-local-runtime` subpath.
- Added CLI coverage proving command discovery and a real `programming-artifact-ontology` activation through a temporary SQLite store with `--address-model sum`, metadata overrides, JSON output, and a taxonomy prefix override.
- Fixed registry-service packaged runtime migration discovery so bundled `dist/ontology-local-runtime.js` resolves `dist/drizzle` instead of the unrelated sibling `packages/drizzle` folder.
- Files changed: `packages/cli/src/command-groups/ontology.commands.ts`, `packages/cli/src/commands/ontology.ts`, `packages/cli/src/commands/ontology.test.ts`, `packages/cli/package.json`, `packages/registry-service/src/bootstrap/stores.ts`, `pnpm-lock.yaml`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`; built-CLI smoke `node packages/cli/dist/index.js ontology registry activate-pack programming-artifact-ontology --store <tmp>/registry.sqlite --ontology-id artifact-dist --namespace artifact_dist --version v-dist --json`.
- **Learnings:**
  - The ontology command group proxy already maps a descriptor id like `ontology.registry.activate-pack` to `cliOntology(["registry.activate-pack", ...rest])`; the handler only needs a matching switch case.
  - The command layer can stay thin by passing parsed flags directly into `activationHelper.activateOntologyPack()` and leaving register/activate/sync/smoke lifecycle ordering inside registry-service.
  - Repeatable `--prefix` needs command-specific parsing because the shared CLI `parseFlags()` intentionally collapses repeated flags into a single string value.
  - Built package subpaths exercise different `import.meta.url` paths than source tests; CLI tests that dynamically import `@qa-sdk/registry-service/ontology-local-runtime` caught a dist-only migration path bug.
---

## 2026-04-15 - US-005
- Defined the `ontology registry activate-pack --json` contract around the activation helper result: successful and helper-returned failed results are printed unwrapped, including `status`, `packId`, `ontologyId`, `namespaceSummary`, `allocationSummaries`, `syncSummariesByAllocationId`, `smokeCheckSummary`, `warnings`, and `errors`.
- Added command-specific flag validation for `activate-pack`, including structured JSON failures for unknown flags and missing flag values when `--json` is present.
- Added sanitized pre-helper runtime failure JSON so storage/runtime exceptions do not expose raw SQLite/SQL details in automation output.
- Kept text output concise while adding action hints for follow-up registry checks or structured error inspection.
- Added CLI coverage for JSON success fields, unknown pack JSON, invalid flag JSON, helper-returned failure payloads, runtime storage error sanitization, and text output action hints.
- Files changed: `packages/cli/src/commands/ontology.ts`, `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `pnpm --filter @qa-sdk/cli build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `activate-pack` needs command-specific flag validation because its descriptor still proxies raw rest args through `cliOntology`, so the shared command parser does not reject unknown flags for this handler.
  - Helper-returned failures are already safe to print as the canonical contract; wrapping them would make automation distinguish success and lifecycle failure unnecessarily.
  - Runtime creation can fail before the helper has a chance to sanitize errors, so the CLI boundary needs its own generic `activation-runtime-error` path for JSON output.
---

## 2026-04-15 - US-006
- Added a CLI scenario test that invokes `main(["ontology", "registry", "activate-pack", "programming-artifact-ontology", "--store", <tmp sqlite>, "--json"])` to prove the real command discovery and dispatch path.
- The test uses an isolated temporary SQLite store, verifies `status: "succeeded"`, and asserts allocation summaries for both `programming-artifact` and `programming-artifact-relation`.
- The test verifies successful sync summaries and smoke check summaries for each allocation, including synced status, materialized/target counts, passing smoke checks, and zero failed checks.
- The test re-runs the same public command against the same store and verifies the documented structured `duplicate-allocation` failure contract without leaking raw SQLite errors.
- Files changed: `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Real command-path acceptance criteria should go through `main()` with argv-style segments, because `cliOntology()` starts after the ontology command-group proxy has already resolved the descriptor.
  - Programming artifact ontology activation creates two taxonomy surfaces by default: node artifact kind and edge relation kind.
  - Re-running activation currently fails during register with helper-returned `duplicate-allocation`; sync itself remains idempotent below the activation helper, but pack reservation is intentionally not an upsert.
---

## 2026-04-15 - US-007
- Added a public CLI scenario test that invokes `main(["ontology", "registry", "activate-pack", "authorization-ontology", "--store", <tmp sqlite>, "--json"])`.
- The test uses an isolated temporary SQLite store and verifies `status: "succeeded"` with the default authorization ontology namespace.
- The test asserts allocation summaries for all eight authorization taxonomies, successful sync summaries for each allocation, passing smoke checks for every allocation, and zero activation warnings/errors.
- The test validates that known authorization ontology axes are represented in emitted sync materialization records.
- Files changed: `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Authorization ontology activation currently materializes eight taxonomy allocation surfaces: node, principal, resource, action, policy, decision, enforcement, and lineage.
  - `allocationSummaries` are the right assertion surface for taxonomy coverage, while axis coverage requires reading the full `syncReports` materialized records.
  - Authorization activation uses product address-model smoke checks for every taxonomy by default, including lineage.
---

## 2026-04-15 - US-008
- Made CLI-origin non-JSON `ontology registry activate-pack` failures include a stable `<code>: <message>` prefix so text-mode automation can distinguish bad input without parsing prose.
- Added public command-path tests for unknown pack id failures in JSON and text output, including non-zero exit code and raw SQL leak assertions.
- Added public command-path tests for invalid `--address-model` failures in JSON and text output, proving the structured `invalid-address-model` contract and non-zero exit code.
- Extended the duplicate activation scenario to prove helper-returned `status: "failed"` results also produce useful non-JSON output without exposing raw SQL.
- Files changed: `packages/cli/src/commands/ontology.ts`, `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Public failure scenarios should use `main(["ontology", "registry", "activate-pack", ...])` because resolver-level and handler-level tests can miss command discovery behavior.
  - Text failure sanitization should avoid treating normal `.sqlite` store paths as leaks; assert against SQLite error tokens and SQL statement fragments instead.
  - CLI pre-helper failures and helper lifecycle failures have different output paths, so both need explicit JSON/text coverage.
---

## 2026-04-15 - US-009
- Added `--output <file>` support to `qa-sdk ontology registry activate-pack` command discovery, help text, usage text, and command-specific flag validation.
- Activation result output now writes the same pretty JSON payload emitted by `--json` to the requested file and creates parent directories as needed.
- CLI-origin activation failures can also persist the stable result-like failure payload when a valid `--output` path is provided.
- Kept stdout behavior stable: `--json` still prints the unwrapped helper payload, while text mode prints the activation summary and includes the resolved output path when used.
- Did not append activation output to the programming artifact registry in this story.
- Files changed: `packages/cli/src/command-groups/ontology.commands.ts`, `packages/cli/src/commands/ontology.ts`, `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `pnpm --filter @qa-sdk/cli build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Activation output persistence fits best as a sidecar JSON materialization, not as a second stdout mode, because existing automation already relies on `--json` being the canonical payload.
  - The activation handler has both pre-helper failure paths and helper result paths; output writing needs to sit on both surfaces if automation should retain failure evidence.
  - Output write failures should remain a CLI failure result instead of falling through the broad runtime catch as `activation-runtime-error`.
---

## 2026-04-15 - US-010
- Added `operational-ontology-registry-activation-cli.spec.md` as the dedicated CLI contract for `qa-sdk ontology registry activate-pack <pack-id>`, including command flags, local SQLite runtime boundary, JSON/text failure contracts, `--output` sidecar behavior, proven scenarios, and follow-up scope.
- Updated `operational-ontology-registry-allocation.spec.md` to reflect the implemented public/local activation CLI surface instead of a future command candidate.
- Updated `operational-ontology-registry-allocation.todo.md` to mark the CLI activation surface complete and keep REST exposure, remote activation service, artifact registry persistence, and scoped prefix support as follow-up work.
- Added the new CLI leaf to `operational-ontology-system` and reflected proven programming-artifact and authorization activation scenarios in their system docs.
- Files changed: `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`, `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`, `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`, `docs/specs/operational-ontology/operational-ontology-system.spec.md`, `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`, `docs/specs/authorization-ontology/authorization-ontology-system.spec.md`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter registry-service test`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - A new public CLI surface is easier to navigate as its own `cli_contract` leaf, while the lifecycle allocation spec should summarize the surface and point to follow-up boundaries.
  - Scenario docs should cite the activation CLI only where command-path tests prove the scenario; handler-only tests would not be enough evidence for public docs.
  - `--output` remains evidence sidecar materialization, not artifact registry persistence, so REST/API and registry append work should stay in separate follow-up stories.
---
