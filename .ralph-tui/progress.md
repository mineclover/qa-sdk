# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- CLI command discovery lives in `packages/cli/src/command-groups/*.commands.ts`; ontology descriptors are proxied by handler key into `cliOntology` in `packages/cli/src/commands/ontology.ts`.
- Local ontology activation should use one SQLite driver for registry-service ontology rows and index-meta rows: apply registry-service/index-meta schema setup, then share the driver across `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, and `SqlIndexMetaStore`.

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
