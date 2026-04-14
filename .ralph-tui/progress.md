# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- CLI command discovery lives in `packages/cli/src/command-groups/*.commands.ts`; ontology descriptors are proxied by handler key into `cliOntology` in `packages/cli/src/commands/ontology.ts`.
- Local ontology activation should use one SQLite driver for registry-service ontology rows and index-meta rows: apply registry-service/index-meta schema setup, then share the driver across `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, and `SqlIndexMetaStore`.
- CLI-local ontology pack sources should resolve through a pure result-union helper in `packages/cli/src/lib`, importing production pack exports only; SQLite/store activation wiring stays outside the resolver so unit tests remain store-free.
- Local ontology activation runtime is exported from `@qa-sdk/registry-service/ontology-local-runtime`; it returns a closeable runtime over one SQLite driver and supports both `:memory:` and persistent `--store`-style paths.

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
