[PRD]
# PRD: Ontology Registry Allocation Lifecycle Master Plan

## Overview

This master PRD tracks the remaining registry allocation lifecycle after the completed local allocation model and Phase 2A persistence schema work. It is not the direct ralph-tui execution file. Each phase gets its own execution PRD and JSON. When a phase PRD closes, review the completed implementation and adjust the next phase PRD before running it.

## Goals

- Keep the full Phase 2B through Phase 5 roadmap visible in one place.
- Preserve phase boundaries so ralph-tui agents do not mix store, service, sync, and activation responsibilities.
- Make every phase consume the contracts completed by the previous phase.
- Require review and PRD adjustment between phases.

## Quality Gates

Every execution PRD derived from this master plan must include phase-specific gates plus:

- `node packages/cli/dist/index.js def validate` - Definition-catalog validation

Registry-service phases must include:

- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`

Operational allocation regression must include:

- `pnpm --filter operational-ontology test -- allocation`

Index-meta phases must include:

- `pnpm --filter index-meta test`
- `pnpm --filter index-meta typecheck`
- `pnpm --filter index-meta build`

No browser verification is required.

## Phase Plan

### Phase 2B: Store Adapter

**Goal:** Add registry-service store boundary for ontology namespace, axis, taxonomy, allocation, and segment records.

**Execution PRD:**
- `tasks/prd-ontology-registry-store-adapter.md`
- `tasks/prd-ontology-registry-store-adapter.json`

**Inputs:**
- `operational-ontology-registry-allocation.spec.md`
- `operational-ontology-registry-persistence-handoff.spec.md`
- Phase 2A tables and migration

**Exit Criteria:**
- `OntologyRegistryStore` interface exists.
- In-memory and SQL adapters implement the same contract.
- Store-level validation covers referenced taxonomy axes, duplicate/drift conflicts, segment range/overlap, and JSON serialization.
- `createRegistryStores()` exposes the ontology store without adding service orchestration.

### Phase 3: Service Layer

**Goal:** Add lifecycle orchestration around the store adapter.

**Execution PRD:**
- `tasks/prd-ontology-registry-service-layer.md`
- `tasks/prd-ontology-registry-service-layer.json`

**Inputs:**
- Phase 2B store contract
- `validateOperationalOntologyPack()`
- `validateOntologyAddressAllocationPlan()`

**Exit Criteria:**
- `OntologyRegistryService` exists.
- `registerOntologyPack()`, `reserveAddressSpace()`, and `activateAllocation()` are implemented.
- Invalid pack or invalid allocation plan is a no-write failure.
- Multi-row writes are transactional.
- Lifecycle transition rules are enforced.
- `syncToPrefixRegistry()` remains a precondition/report shell unless Phase 4 is also selected.

### Phase 4: Index-Meta Sync

**Goal:** Materialize active ontology allocations into index-meta prefix and schema records.

**Execution PRD:**
- `tasks/prd-ontology-registry-index-meta-sync.md`
- `tasks/prd-ontology-registry-index-meta-sync.json`

**Inputs:**
- Phase 3 active allocation contract
- `operational-ontology-index-meta-sync-handoff.spec.md`

**Exit Criteria:**
- Active allocations sync to index-meta.
- Product allocation mapping is implemented.
- Sum allocation behavior is explicitly implemented or deferred with a tested guard.
- Sync is idempotent.
- Prefix/version collisions and capacity drift are reported.

### Phase 5: Activation Smoke

**Goal:** Prove the end-to-end activation lifecycle.

**Inputs:**
- Phase 3 service layer
- Phase 4 sync behavior

**Next PRD Start Rule:**
- The Phase 5 execution PRD must start with a review/adjustment story for the completed Phase 4 implementation.
- Do not edit `tasks/prd-ontology-registry-index-meta-sync.json` after a ralph-tui run has started; carry any newly discovered Phase 4 assumptions into the first Phase 5 story instead.

**Exit Criteria:**
- `activateOntologyPack(pack, options)` or equivalent helper exists.
- Valid pack produces active allocation and index-meta resolve/decode smoke success.
- Invalid pack leaves no partial registry rows.
- Duplicate prefix/version activation is blocked.
- Activation result payload includes namespace, allocation, sync, warning, and error summaries.

### Phase 6: Prefix Policy

**Goal:** Keep scoped prefix schema changes frozen unless concrete need is proven.

**Inputs:**
- `operational-ontology-scoped-prefix-decision.spec.md`

**Exit Criteria:**
- No implementation is needed while global prefix uniqueness remains sufficient.
- If scoped prefix support becomes necessary, create a separate implementation ADR and PRD before changing prefix table, API, index-meta key shape, or decode cache keys.

## Operating Rule

After each execution PRD closes:

- Review implementation and tests against that phase's exit criteria.
- Update `operational-ontology-registry-allocation.spec.md` with completed current-state behavior.
- Update `operational-ontology-registry-allocation.todo.md` to close completed items and keep later phase items open.
- Adjust the next phase PRD before converting/running it.
- If the next phase PRD already started running, do not edit that active PRD; put the adjustment in the first story of the following phase PRD.
- Record the next execution PRD path in this master roadmap before handing it to ralph-tui.

## Non-Goals

- Running this master PRD directly with ralph-tui.
- Combining Phase 2B, 3, 4, and 5 into one execution batch.
- Changing scoped prefix semantics before the decision gate is reopened.

## Open Questions

- Should Phase 3 expose a REST endpoint, CLI-only adapter, or internal service only?
- Should Phase 4 implement sum allocation sync immediately or defer until index-meta has a segment model?
- Should activation smoke use an existing registry-service module or a new ontology module boundary?
[/PRD]
