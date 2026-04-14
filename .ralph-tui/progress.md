# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Ontology validation boundary docs should be focused leaf specs under `operational-ontology-system` with top-level `sources` that name both implementation and test files. Use registry-service/index-meta references as lifecycle boundary evidence; do not require their implementation for local validation stories.
- Ontology design-change validation matrices should put local `operational-ontology` gates in each scenario row and keep registry-service/index-meta activation commands in a separate boundary column; core gate rows should name impact analysis or escalation explicitly.
- Plan/todo sibling docs should use `traces_to` for cross-links. Mutual `refines` between contained plan/todo leaves can create definition graph cycles after `def sync`.
- Allocation validation contract docs should name implementation, public facade, and test `sources`, then split local pure-function invariants from registry-service/index-meta persistence invariants. Keep existing tests as the executable SSOT rather than restating behavior as prose-only authority.
- Large lifecycle TODOs can preserve legacy phase references by splitting a crowded phase into lettered subphases and adding a dependency map before the checklist. This keeps old acceptance criteria stable while making ralph-tui task boundaries executable.

---

## 2026-04-14 - US-001
- Added `operational-ontology-validation-boundary` to define the validation boundary for ontology design changes.
- Linked the new guide from `operational-ontology-system` and updated the system overview/delegates list.
- Added implementation/test `sources` to the registry allocation plan.
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-validation-boundary.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation-plan.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation-todo.todo.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Existing `operational-ontology-ssot-navigation-guide` already maps SSOT ownership but is above the leaf split threshold, so a new focused validation leaf was safer than expanding it.
  - `sources:` is a top-level frontmatter block outside `def:` and can point at multiple package implementation/test files for code reference coverage.
  - `sources:` can also create ambiguous boundary ownership when the same implementation file is already linked under a narrower module, so broad boundary guides should defer to child docs for those source links.
  - Local ontology validation stories stop at docs plus operational-ontology package gates; registry-service/index-meta persistence and sync belong to allocation lifecycle follow-ups.
---

## 2026-04-14 - US-002
- Added `operational-ontology-allocation-validation-contract` as a focused leaf contract for current allocation projection and validation invariants.
- Linked the contract into `operational-ontology-system` and marked the registry allocation TODO Phase 1 contract item complete.
- Verified definition graph and operational-ontology package gates.
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-allocation-validation-contract.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `validateOntologyAddressAllocationPlan()` includes schema validation issues under `schema.*` when a schema is provided, so missing taxonomy axes surface through both schema validation and allocation validation.
  - The allocation core intentionally builds a plan before validation; missing axis capacity falls through to invalid allocation evidence rather than preventing plan construction.
  - `qa-sdk def context` can print useful context and still exit nonzero when the local feedback DB cannot be opened; `node packages/cli/dist/index.js def validate` is the required completion gate here.
---

## 2026-04-14 - US-003
- Added `operational-ontology-design-change-validation-matrix` as a focused leaf guide for ontology design change validation paths.
- Linked the matrix from `operational-ontology-system` and added it to the `operational-ontology` package README.
- Verified required local gates:
  - `pnpm --filter operational-ontology test`
  - `pnpm --filter operational-ontology typecheck`
  - `pnpm --filter operational-ontology build`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-design-change-validation-matrix.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `packages/operational-ontology/README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - A matrix leaf can satisfy validation-routing requirements without expanding `operational-ontology-validation-boundary` or the allocation contract past their focused roles.
  - Each scenario row needs its own command surface; using "same as above" weakens the acceptance criterion because future readers can miss the concrete gate.
  - Core ontology gate changes should route to `qa-sdk flow analyze <schema-id> --impact <gate-id>` or an escalation request before local docs/code edits.
  - Local validation is docs plus `operational-ontology` package gates; registry-service/index-meta persistence, activation audit, active sync, and smoke decode remain separate activation lifecycle work.
---

## 2026-04-14 - US-004
- Reorganized `operational-ontology-registry-allocation-todo` into executable registry allocation phases: persistence schema, store adapter, service layer, index-meta sync, activation smoke, and prefix policy.
- Added an explicit dependency map, including the Phase 2 persistence independence from Phase 4 index-meta sync.
- Added goal, non-goals, prerequisites, and validation commands for each phase while preserving the existing open TODO items.
- Verified required gates:
  - `pnpm --filter operational-ontology test`
  - `pnpm --filter operational-ontology typecheck`
  - `pnpm --filter operational-ontology build`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - When an acceptance criterion names a legacy phase number, keep that phase label stable and use subphase IDs for new task boundaries.
  - Phase-level validation commands work better when separated into immediate local gates and future touched-package gates; this TODO now keeps both visible per phase.
  - Vitest on Node 24 can abort after reporting all tests passed; rerunning the exact command completed cleanly, so this looked like a transient worker shutdown issue rather than a source regression.
---
