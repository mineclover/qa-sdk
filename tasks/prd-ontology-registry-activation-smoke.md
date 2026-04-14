[PRD]
# PRD: Ontology Registry Activation Smoke

## Overview

Implement Phase 5 of the operational ontology registry allocation lifecycle. Phase 4 materialized active allocations into index-meta prefix/schema records and returns sync reports. This PRD adds the end-to-end activation helper and smoke checks that prove valid packs can travel through validation, reservation, activation, index-meta sync, and post-sync verification while invalid packs and duplicate allocations leave no partial state.

This phase does not add REST endpoints, CLI commands, scoped prefix support, address state cache, or eager entry materialization.

## Goals

- Review Phase 4 sync implementation against handoff and smoke requirements before adding activation orchestration.
- Add `activateOntologyPack(pack, options)` or an equivalent internal helper.
- Compose pack validation, reservation, allocation activation, index-meta sync, and smoke checks.
- Prove valid pack activation produces active allocation and index-meta resolve/decode success.
- Prove invalid pack/allocation leaves no partial registry rows.
- Prove duplicate prefix/version activation is blocked.
- Return a structured activation result payload.
- Reflect Phase 5 completion in docs and TODO.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter registry-service test` - Registry-service test suite
- `pnpm --filter registry-service typecheck` - Registry-service type checking
- `pnpm --filter registry-service build` - Registry-service build
- `pnpm --filter index-meta test` - Index-meta regression tests
- `pnpm --filter index-meta typecheck` - Index-meta type checking
- `pnpm --filter index-meta build` - Index-meta build
- `pnpm --filter operational-ontology test -- allocation` - Allocation contract regression
- `node packages/cli/dist/index.js def validate` - Definition-catalog validation

No browser verification is required.

## User Stories

### US-001: Review Phase 4 Sync Contract and Adjust Smoke Assumptions

**Description:** As an ontology maintainer, I want Phase 4 sync assumptions reviewed before activation smoke so that Phase 5 does not encode a stale or impossible contract.

**Acceptance Criteria:**
- [ ] Review Phase 4 sync implementation and tests against `operational-ontology-index-meta-sync-handoff.spec.md`.
- [ ] Reconcile the handoff statement about axis leaf `valuesHash` drift with the actual index-meta materialization surface.
- [ ] If `valuesHash` is not persisted in index-meta, update docs to state that Phase 4 detects capacity/refs drift and that valuesHash reproduction only applies when future axis-value entry materialization is implemented.
- [ ] Confirm Phase 4 report fields are sufficient for Phase 5 smoke checks.
- [ ] Do not edit the already completed Phase 4 PRD JSON as part of this story.

### US-002: Define Activation Helper Boundary

**Description:** As a registry-service developer, I want an internal activation helper boundary so that activation smoke orchestration is separate from store and sync internals.

**Acceptance Criteria:**
- [ ] Add `activateOntologyPack(pack, options)` or equivalent helper under the ontology module/service boundary.
- [ ] Define activation input options for ontology id, namespace, owner, version id, address model, capacity overrides, prefix overrides, and timestamp.
- [ ] Define activation result payload with pack id, ontology id, namespace record, allocations, activation statuses, sync reports, warnings, and errors.
- [ ] Helper uses `OntologyRegistryService` methods instead of raw store or raw SQL access.
- [ ] Helper does not add REST routes or CLI commands.

### US-003: Implement Valid Pack Activation Flow

**Description:** As an ontology operator, I want a valid pack to validate, reserve, activate, and sync so that a complete activation path exists internally.

**Acceptance Criteria:**
- [ ] Valid pack activation runs pack validation before reservation.
- [ ] Valid pack activation reserves address space and writes namespace, axis, taxonomy, allocation, and segment rows.
- [ ] Activation moves every intended allocation from `reserved` to `active` or documents a deterministic selection policy if only selected allocations activate.
- [ ] Activation calls index-meta sync for every activated allocation.
- [ ] Activation result reports each allocation id, prefix, version id, status, and sync status.
- [ ] Index-meta prefix registry and schema version records exist for synced allocations.

### US-004: Add Product Activation Smoke Checks

**Description:** As an ontology operator, I want product allocation activation smoke checks so that composite index-meta materialization is proven after sync.

**Acceptance Criteria:**
- [ ] Smoke checks assert source allocation status is `active`.
- [ ] Smoke checks assert `PrefixRegistry.getRecord(prefix, versionId)` returns the intended product allocation prefix record.
- [ ] Smoke checks assert schema version capacity matches prefix registry capacity.
- [ ] Smoke checks assert `PrefixRegistry.getShape(prefix, versionId)` equals ordered axis capacities.
- [ ] Smoke checks assert last valid address index resolves in range.
- [ ] Smoke checks assert capacity index resolves as out of range.
- [ ] Smoke checks are available in the activation result payload.

### US-005: Add Sum Activation Smoke Checks

**Description:** As an ontology operator, I want sum allocation activation smoke checks so that leaf sync and segment sidecar semantics are explicit.

**Acceptance Criteria:**
- [ ] Smoke checks assert source allocation status is `active`.
- [ ] Smoke checks assert sum allocation prefix registry record exists as a leaf record.
- [ ] Smoke checks assert schema version capacity matches sum allocation capacity.
- [ ] Smoke checks assert segment sidecar metadata covers the allocation range according to the chosen Phase 4 policy.
- [ ] Smoke checks do not claim product DAG decode semantics for sum segments.
- [ ] Smoke checks are available in the activation result payload.

### US-006: Prove Invalid Pack and Invalid Allocation No-Write

**Description:** As a registry-service maintainer, I want invalid activation inputs to leave no partial state so that activation is safe to retry after correction.

**Acceptance Criteria:**
- [ ] Invalid pack activation returns a structured invalid-pack error.
- [ ] Invalid pack activation leaves no namespace, axis, taxonomy, allocation, segment, prefix registry, or schema version records.
- [ ] Invalid allocation plan returns a structured invalid-allocation-plan error.
- [ ] Invalid allocation plan leaves no partial registry-service or index-meta rows.
- [ ] Tests cover both in-memory and SQL-backed registry-service stores where practical.

### US-007: Prove Duplicate Prefix/Version Activation Is Blocked

**Description:** As an ontology operator, I want duplicate active prefix/version activation blocked so that global prefix uniqueness is preserved.

**Acceptance Criteria:**
- [ ] Activation is blocked when another active allocation already owns the same `(prefix, versionId)`.
- [ ] Activation is blocked when index-meta already has mismatched prefix registry records for the target `(prefix, versionId)`.
- [ ] Activation is blocked when index-meta already has mismatched schema version capacity for the target `(prefix, versionId)`.
- [ ] Blocked activation returns structured errors with allocation ids, prefix, version id, and drift/collision details.
- [ ] Blocked activation does not overwrite existing index-meta records.

### US-008: Add Activation Result Payload Tests

**Description:** As a future API/CLI implementer, I want activation result payload tests so public surfaces can later expose activation without guessing shape.

**Acceptance Criteria:**
- [ ] Activation success result includes namespace record summary.
- [ ] Activation success result includes allocation records and statuses.
- [ ] Activation success result includes sync summaries grouped by allocation id.
- [ ] Activation success result includes smoke check summary.
- [ ] Activation failure result or thrown error includes enough structured context to identify failed phase.
- [ ] Payload does not expose raw SQL errors.

### US-009: Reflect Phase 5 Completion in Docs and TODO

**Description:** As an ontology documentation maintainer, I want Phase 5 completion reflected in specs and TODO so remaining roadmap work is explicit.

**Acceptance Criteria:**
- [ ] Update `operational-ontology-registry-allocation.todo.md` to mark Phase 5 activation smoke items complete.
- [ ] Update `operational-ontology-registry-allocation.spec.md` to summarize activation helper, smoke checks, and result payload.
- [ ] Update `operational-ontology-index-meta-sync-handoff.spec.md` if Phase 5 clarifies sync smoke responsibilities.
- [ ] Update `tasks/prd-ontology-registry-allocation-lifecycle-master.md` with final Phase 5 state and any remaining Phase 6 policy-only work.
- [ ] Keep scoped prefix implementation out of scope unless a new decision PRD is created.

## Functional Requirements

- FR-1: Activation must validate packs before writing registry rows.
- FR-2: Activation must reserve, activate, sync, and smoke-check in a deterministic order.
- FR-3: Invalid inputs must leave no partial registry-service or index-meta state.
- FR-4: Product activation must prove composite prefix shape and address range behavior.
- FR-5: Sum activation must prove leaf prefix/schema version plus segment sidecar coverage.
- FR-6: Activation must preserve global `(prefix, versionId)` uniqueness.
- FR-7: Activation result payload must be structured and test-covered.
- FR-8: Activation uses no cross-boundary rollback after an allocation has been activated or synced; later failures return a structured failed activation result.

## Non-Goals

- Adding REST controllers.
- Adding CLI commands.
- Adding scoped prefix support.
- Adding index-meta segment tables.
- Eagerly materializing product combinations as entries.
- Computing address state/range cache.
- Changing public prefix API shape.

## Technical Considerations

- Service/sync inputs:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`
  - `packages/registry-service/src/stores/ontology-registry-store.ts`
- Index-meta checks:
  - `packages/index-meta/src/prefix-registry.ts`
  - `packages/index-meta/src/adapters/sql-prefix-registry.ts`
  - `packages/index-meta/src/adapters/sql-store.ts`
- Handoff docs:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md`

## Success Metrics

- Valid pack activation creates active allocation plus synced index-meta records.
- Invalid pack/allocation leaves no partial rows.
- Duplicate prefix/version activation is blocked before overwrite.
- Product and sum smoke checks are present in result payload.
- The remaining roadmap is limited to scoped prefix policy or optional public API exposure.

## Open Questions

- Should activation helper live as a method on `OntologyRegistryService`, or as a separate orchestration helper using the service?
- Should activation activate all allocations from a pack or accept a selected taxonomy/allocation subset?
- Should failed sync after activation roll back allocation status, or return a failed activation result with active registry rows and no index-meta overwrite?
[/PRD]
