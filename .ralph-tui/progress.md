# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Neutral document control-plane adapters should preserve source-owned vocabulary in plain string fields and normalize only coordination concerns: identity, paths, metadata defaults, and collection defaults.
- CLI tests that touch optional `~/.qa-sdk` side stores should set `QA_SDK_HOME` to a temp directory so developer-local ledgers cannot affect hermetic assertions.

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
