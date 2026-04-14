# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Ontology validation boundary docs should be focused leaf specs under `operational-ontology-system` with top-level `sources` that name both implementation and test files. Use registry-service/index-meta references as lifecycle boundary evidence; do not require their implementation for local validation stories.
- Ontology design-change validation matrices should put local `operational-ontology` gates in each scenario row and keep registry-service/index-meta activation commands in a separate boundary column; core gate rows should name impact analysis or escalation explicitly.
- Ontology graph requirement docs should keep `.plan.md` and `.todo.md` as filename variants, not `def.type` values. `def.type` remains `spec` or `knowledge`; plans/todos usually stay `level: leaf` and link to owning specs/plans with `refines`, `depends_on`, or `traces_to`.
- Plan/todo sibling docs should use `traces_to` for cross-links. Mutual `refines` between contained plan/todo leaves can create definition graph cycles after `def sync`.
- Allocation validation contract docs should name implementation, public facade, and test `sources`, then split local pure-function invariants from registry-service/index-meta persistence invariants. Keep existing tests as the executable SSOT rather than restating behavior as prose-only authority.
- Large lifecycle TODOs can preserve legacy phase references by splitting a crowded phase into lettered subphases and adding a dependency map before the checklist. This keeps old acceptance criteria stable while making ralph-tui task boundaries executable.
- Allocation drift fixtures should assert structured `target` data on validation issues, not only free-text messages. Prefix/version collisions should expose `prefix` and `versionId`; taxonomy-axis mismatches should expose `taxonomyId` and `axisId`.
- Registry persistence handoff specs should define conceptual records, local model field mappings, collision rules, and future registry-service tests without adding Drizzle schema or migrations in the handoff story.
- Index-meta sync handoff specs should map product allocations to current `PrefixRegistryRecord.refs`, keep sum allocations as leaf prefix records plus sidecar segment metadata until index-meta owns a segment model, and define retry/smoke rules without changing index-meta code.
- Prefix policy decision docs should stay as focused ADR leaves under `operational-ontology-system`, freeze current registry/index-meta/decode key shapes, and treat scoped-prefix options as gated criteria until a separate implementation ADR exists.

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

## 2026-04-14 - US-005
- Added `operational-ontology-definition-graph-requirements` as a focused validation leaf for ontology module/leaf/plan/todo/knowledge frontmatter, `contains`, split, and `sources` rules.
- Linked the new graph requirements doc from `operational-ontology-system` and referenced it in the validation boundary and design-change matrix.
- Verified definition validation and operational-ontology package gates.
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-definition-graph-requirements.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-validation-boundary.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-design-change-validation-matrix.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `def.type` only supports `spec` and `knowledge`; `.plan.md` and `.todo.md` are parsed from filename variant priority, so ontology docs should not invent plan/todo frontmatter types.
  - Module docs that mention child docs in `^overview` or `^delegates` need matching `contains` links, while leaf/plan/todo docs should avoid `contains` unless promoted into a real module boundary.
  - A practical split guard is to review ontology leaves around 120 lines and split before adding new sections near 140 lines, avoiding the 150-line `leaf-too-long` warning.
---

## 2026-04-14 - US-006
- Added structured `target` data to local ontology allocation validation issues so drift errors identify the offending prefix/version, taxonomy, axis, allocation, or segment.
- Extended the operational-ontology allocation test fixture with a combined allocation drift case covering a prefix/version collision and a taxonomy-axis mismatch before registry persistence exists.
- Verified the required operational-ontology and definition validation gates.
- Files changed:
  - `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
  - `packages/operational-ontology/src/allocation.ts`
  - `packages/operational-ontology/src/schema.ts`
  - `packages/operational-ontology/src/allocation.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Allocation validation already projects a complete local plan before persistence, so one fixture can exercise schema validation drift and allocation validation drift without registry-service or index-meta.
  - Prefix/version duplicate detection benefits from an explicit structured issue target because the duplicate key alone is not enough for downstream tooling to safely route fixes.
  - `node packages/cli/dist/index.js def validate` should not run while an operational-ontology build is cleaning `dist`; rerun it after the build completes to avoid transient subpath resolution failures.
---

## 2026-04-14 - US-007
- Added `operational-ontology-registry-persistence-handoff` as a focused leaf spec for registry-service persistence record contracts.
- Mapped namespace, axis, taxonomy, allocation, and segment records back to local allocation model fields.
- Documented store/service collision rules and future registry-service tests while keeping DB schema implementation out of scope.
- Linked the handoff from `operational-ontology-system`, the registry allocation roadmap/TODO, and the operational-ontology README.
- Verified required gates:
  - `pnpm --filter operational-ontology test`
  - `pnpm --filter operational-ontology typecheck`
  - `pnpm --filter operational-ontology build`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `packages/operational-ontology/README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Handoff specs work best as leaf docs under the system overview: they can name registry-service files as future boundary evidence without changing that package.
  - Persistence record contracts should preserve ordered JSON fields from the local model, especially axis `values` and taxonomy axis lists, because local hashes and allocation offsets are order-sensitive.
  - Future registry-service tests should be split into store contract tests, SQL schema/constraint tests, and service transaction/no-write tests so Phase 2A/2B/3 can progress independently.
---

## 2026-04-14 - US-008
- Added `operational-ontology-index-meta-sync-handoff` as a focused leaf spec for active allocation sync into index-meta prefix registry and schema version records.
- Defined required active allocation sync input, product allocation materialization, sum allocation limits, segment materialization boundary, idempotency/collision expectations, and minimum activation smoke checks.
- Linked the handoff from `operational-ontology-system`, referenced it from the registry allocation roadmap/TODO, marked the Phase 4 handoff-only contract item complete, and added it to the operational-ontology README.
- Verified required gates:
  - `pnpm --filter operational-ontology test`
  - `pnpm --filter operational-ontology typecheck`
  - `pnpm --filter operational-ontology build`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `packages/operational-ontology/README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Current index-meta `PrefixRegistryRecord.refs` represents product shape, so sum allocation cannot be fully expressed through `prefix_ref` without a future segment/sum model.
  - Handoff docs can reference plan/TODO ids in prose while keeping frontmatter links one-way from the handoff to avoid definition graph cycles.
  - Focused handoff leaf specs should stay under the 150-line split warning by pushing implementation task lists back into the roadmap/TODO.
---

## 2026-04-14 - US-009
- Added `operational-ontology-scoped-prefix-decision` as a focused ADR leaf for retaining global prefix uniqueness versus introducing scoped prefixes.
- Documented concrete need criteria, catalog id / ontology id / tenant boundary / pack collision scenarios, affected `/prefixes/:prefix`, index-meta key shape, decode-service/cache key, and migration-plan surfaces.
- Linked the decision doc from `operational-ontology-system`, referenced it from the registry allocation roadmap/TODO, marked Phase 6 criteria/surface-analysis items complete, and added it to the operational-ontology README.
- Verified required gates:
  - `pnpm --filter operational-ontology test`
  - `pnpm --filter operational-ontology typecheck`
  - `pnpm --filter operational-ontology build`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-scoped-prefix-decision.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-system.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `packages/operational-ontology/README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Prefix schema decisions need an explicit freeze rule because registry-service routes, index-meta tables, and decode-service caches all currently assume prefix/version identity.
  - Pack collision alone is not enough evidence for scoped prefixes; the collision must also prove a catalog, ontology, or tenant boundary that cannot be solved by deterministic renaming.
  - `def context` can still return useful document context while exiting nonzero when the local feedback DB cannot open; completion should rely on `node packages/cli/dist/index.js def validate`.
---
