# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Ontology validation boundary docs should be focused leaf specs under `operational-ontology-system` with top-level `sources` that name both implementation and test files. Use registry-service/index-meta references as lifecycle boundary evidence; do not require their implementation for local validation stories.
- Plan/todo sibling docs should use `traces_to` for cross-links. Mutual `refines` between contained plan/todo leaves can create definition graph cycles after `def sync`.
- Allocation validation contract docs should name implementation, public facade, and test `sources`, then split local pure-function invariants from registry-service/index-meta persistence invariants. Keep existing tests as the executable SSOT rather than restating behavior as prose-only authority.

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
