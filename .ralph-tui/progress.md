# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Build validation for registry-service consumers should run dependency builds first; do not run `operational-ontology build` concurrently with `registry-service build` because registry-service DTS generation consumes operational-ontology declarations.

---

## 2026-04-15 - US-001
- Closed the completed local lifecycle state in the CLI scenario hardening PRD by marking US-001 acceptance criteria complete and recording confirmation notes.
- Verified the allocation lifecycle remains closed through Phase 5 plus activation CLI and activation evidence persistence, with no next lifecycle implementation PRD.
- Verified activation evidence persistence is completed in the lifecycle master and authorization ontology docs, while REST activation endpoint, remote activation service, scoped prefix support, production registry persistence, new registry-service tables, and rollback semantics remain out of scope.
- No runtime code was changed.
- Files changed: `tasks/prd-ontology-registry-cli-scenario-hardening.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter operational-ontology build`; `pnpm --filter authorization-ontology build`; `pnpm --filter registry-service build`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service typecheck`; `pnpm --filter authorization-ontology typecheck`; `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Planning closeout stories can be completed by checking the master roadmap, the active execution PRD, and adjacent system specs, then recording evidence without reopening implementation docs that already state the current behavior.
  - `authorization-ontology-system.spec.md` lives under `docs/specs/authorization-ontology/`, not the operational ontology spec directory referenced by several nearby docs.
  - The manual build gate order matters because registry-service declaration generation reads built operational ontology outputs.
---
