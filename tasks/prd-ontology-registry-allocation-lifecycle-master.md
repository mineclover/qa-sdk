[PRD]
# PRD: Ontology Registry Allocation Lifecycle Master Plan

## Overview

This master PRD tracks the registry allocation lifecycle after the completed local allocation model, Phase 2A persistence schema, Phase 2B store adapter, Phase 3 service layer, Phase 4 index-meta sync, and Phase 5 activation smoke work. It is not the direct ralph-tui execution file. Each implementation phase gets its own execution PRD and JSON. The remaining lifecycle roadmap is Phase 6 policy-only unless a scoped-prefix decision PRD is created. Public/local follow-up surfaces are tracked separately and must not reopen the lifecycle phases.

## Goals

- Keep the completed Phase 2B through Phase 5 history and remaining Phase 6 policy-only state visible in one place.
- Preserve phase boundaries so ralph-tui agents do not mix store, service, sync, and activation responsibilities.
- Make every phase consume the contracts completed by the previous phase.
- Require review and PRD adjustment between phases.
- Keep scoped prefix implementation out of scope unless a new decision PRD reopens it.

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

**Status:** Completed through US-009. The current behavior is documented in `operational-ontology-registry-allocation.spec.md`, `operational-ontology-index-meta-sync-handoff.spec.md`, and `operational-ontology-registry-allocation.todo.md`.

**Inputs:**
- Phase 3 active allocation contract
- `operational-ontology-index-meta-sync-handoff.spec.md`

**Exit Criteria:**
- Active allocations sync to index-meta.
- Product allocation mapping is implemented.
- Sum allocation behavior is implemented as leaf prefix/schema materialization plus tested segment sidecar metadata.
- Sync is idempotent.
- Prefix/version collisions and capacity drift are reported.
- Post-sync report readbacks expose Phase 5 smoke inputs without implementing the Phase 5 helper.

### Phase 5: Activation Smoke

**Goal:** Prove the end-to-end activation lifecycle.

**Execution PRD:**
- `tasks/prd-ontology-registry-activation-smoke.md`
- `tasks/prd-ontology-registry-activation-smoke.json`

**Status:** Completed through US-009. The current behavior is documented in `operational-ontology-registry-allocation.spec.md`, `operational-ontology-index-meta-sync-handoff.spec.md`, and `operational-ontology-registry-allocation.todo.md`.

**Inputs:**
- Phase 3 service layer
- Phase 4 sync behavior
- `OntologyIndexMetaSyncMaterializationReport.postSyncChecks`

**Exit Criteria:**
- `OntologyPackActivationHelper` and `activateOntologyPack(pack, options)` exist under the ontology module boundary.
- Valid pack activation is an all-allocation path: registration validates before reservation, then every returned allocation is activated, synced, and smoke checked.
- Product activation smoke uses post-sync target records, ordered shape checks, and resolver bounds checks from Phase 4 reports.
- Sum activation smoke uses only leaf prefix/schema capacity and exact-allocation-range sidecar coverage from Phase 4 reports.
- Invalid pack and invalid allocation-plan activation leave no partial registry rows or index-meta rows.
- Duplicate prefix/version activation is blocked before allocation status mutation and before index-meta sync writes.
- Blocked sync activation preserves existing index-meta records and reports relevant drift collisions.
- Activation result payload includes raw namespace/allocation/sync/smoke detail plus `namespaceSummary`, `allocationSummaries`, `syncSummariesByAllocationId`, `smokeCheckSummary`, warnings, and errors.

### Phase 6: Prefix Policy

**Goal:** Keep scoped prefix schema changes frozen unless concrete need is proven.

**Status:** Policy-only. No scoped prefix implementation is selected. Global `(prefix, versionId)` uniqueness remains the active registry-service/index-meta/decode key policy.

**Inputs:**
- `operational-ontology-scoped-prefix-decision.spec.md`

**Exit Criteria:**
- No implementation is needed while global prefix uniqueness remains sufficient.
- If scoped prefix support becomes necessary, create a separate implementation ADR and PRD before changing prefix table, API, index-meta key shape, or decode cache keys.

### Post-Lifecycle Follow-up: Activation Evidence Persistence

**Goal:** Persist successful local activation CLI results into the programming artifact registry as managed evidence.

**Execution PRD:**
- `tasks/prd-ontology-registry-activation-evidence-persistence.md`
- `tasks/prd-ontology-registry-activation-evidence-persistence.json`

**Status:** Completed public/local follow-up outside the allocation lifecycle. This did not create Phase 6 implementation work and did not change scoped prefix policy.

**Inputs:**
- Completed activation CLI: `tasks/prd-ontology-registry-activation-cli.md`
- `operational-ontology-registry-activation-cli.spec.md`
- `programming-artifact-ontology-cli.spec.md`

**Exit Criteria:**
- `qa-sdk ontology registry activate-pack <pack-id> --output <file> --artifact-registry <registry>` appends successful activation evidence explicitly.
- `--output` alone remains sidecar-only and does not append registry records.
- Existing artifact registry validate/list/provider lookup can consume the activation evidence record.
- REST activation endpoint, remote activation service, and scoped prefix support remain separate follow-ups.

### Post-Lifecycle Follow-up: CLI Scenario Hardening Before REST

**Goal:** Keep REST and remote activation deferred while strengthening local CLI scenario evidence across known ontology packs, output/evidence modes, failure modes, and rerun/idempotency behavior.

**Execution PRD:**
- `tasks/prd-ontology-registry-cli-scenario-hardening.md`

**Status:** Planned pre-REST follow-up. This is the next recommended work before opening registry-service REST activation endpoint design.

**Inputs:**
- Completed activation CLI: `tasks/prd-ontology-registry-activation-cli.md`
- Completed activation evidence persistence: `tasks/prd-ontology-registry-activation-evidence-persistence.md`
- `operational-ontology-registry-activation-cli.spec.md`
- `authorization-ontology-system.spec.md`
- `programming-artifact-ontology-cli.spec.md`

**Exit Criteria:**
- CLI scenario matrix documents pack coverage for `programming-artifact-ontology` and `authorization-ontology`.
- Scenario proof covers sidecar-only output, explicit activation evidence append, registry validate/list/extract consumption, duplicate/rerun behavior, and structured failure surfaces.
- Any remaining REST, remote activation, scoped-prefix, or production registry persistence work stays outside this PRD.

## Operating Rule

After each execution PRD closes:

- Review implementation and tests against that phase's exit criteria.
- Update `operational-ontology-registry-allocation.spec.md` with completed current-state behavior.
- Update `operational-ontology-registry-allocation.todo.md` to close completed items and keep later phase items open.
- Adjust the next phase PRD before converting/running it.
- If the next phase PRD already started running, do not edit that active PRD; put the adjustment in the first story of the following phase PRD.
- Record the next execution PRD path in this master roadmap before handing it to ralph-tui.

After Phase 5, there is no next implementation PRD in this lifecycle. Phase 6 can only reopen through the scoped-prefix decision gate and a new decision PRD. Post-lifecycle public/local follow-ups may have their own PRDs, but they must not change registry allocation lifecycle semantics.

## Non-Goals

- Running this master PRD directly with ralph-tui.
- Combining Phase 2B, 3, 4, and 5 into one execution batch.
- Changing scoped prefix semantics before the decision gate is reopened.

## Open Questions

- None for the completed Phase 5 lifecycle. Activation smoke uses the existing registry-service ontology module boundary.
[/PRD]
