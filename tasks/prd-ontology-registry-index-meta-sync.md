[PRD]
# PRD: Ontology Registry Index-Meta Sync

## Overview

Implement Phase 4 of the operational ontology registry allocation lifecycle. Phase 3 added `OntologyRegistryService` with a deferred `syncToPrefixRegistry()` report shell. This PRD replaces that deferred shell with real index-meta materialization for active allocations while preserving the same service-level method boundary.

This phase writes index-meta prefix registry and schema version records for active ontology allocations. It does not implement activation smoke helper, REST routes, CLI commands, scoped prefixes, or a new index-meta segment table.

## Goals

- Build a sync input bundle from active allocation, namespace, taxonomy, axis, and segment records.
- Materialize product allocations into index-meta leaf axis prefixes and composite parent prefixes.
- Materialize sum allocations as leaf prefixes with segment sidecar report metadata.
- Write matching schema version records for every materialized prefix.
- Enforce idempotency, collision, and capacity drift checks.
- Return structured sync reports.
- Reflect Phase 4 completion in docs and TODO.

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

### US-001: Define Index-Meta Sync Adapter Boundary

**Description:** As a registry-service developer, I want a sync adapter boundary so that `OntologyRegistryService` can materialize active allocations without embedding index-meta details in unrelated service logic.

**Acceptance Criteria:**
- [ ] Add a sync adapter interface or internal helper under `packages/registry-service/src/modules/ontology/` or a similarly scoped module.
- [ ] Define sync input bundle shape containing allocation, namespace, taxonomy, axes, and segments.
- [ ] Define sync report shape for materialized records, no-op idempotent records, repaired records, collisions, and deferred/unsupported sum segment semantics.
- [ ] Adapter depends on index-meta `PrefixRegistry` and schema version store APIs, not raw index-meta tables.
- [ ] Adapter does not add REST routes or CLI commands.
- [ ] Existing deferred report shape from Phase 3 remains source-compatible where possible.

### US-002: Collect Active Allocation Sync Bundle

**Description:** As a registry-service developer, I want the service to collect a complete active allocation bundle so that sync does not infer ontology state from index-meta.

**Acceptance Criteria:**
- [ ] `syncToPrefixRegistry(allocationId)` loads the active allocation from `OntologyRegistryStore`.
- [ ] Method rejects missing allocation and non-active allocation as before.
- [ ] Method loads the allocation namespace, taxonomy, required axes, and segments from the store.
- [ ] Missing namespace, taxonomy, axis, or segment data returns structured sync precondition errors.
- [ ] Bundle preserves taxonomy `axisIds` order.
- [ ] Bundle preserves segment `addressOffset`, `addressSize`, and `consumes`.

### US-003: Materialize Product Allocation Prefixes

**Description:** As an ontology registry operator, I want product allocations materialized into index-meta prefix records so that composite decode can use existing prefix DAG behavior.

**Acceptance Criteria:**
- [ ] For each taxonomy axis, derive a deterministic axis leaf prefix name.
- [ ] Register each axis leaf prefix/version with capacity matching the axis registration.
- [ ] Register the allocation prefix/version as a composite prefix with refs in taxonomy `axisIds` order.
- [ ] Parent capacity equals allocation capacity, allocation address size, and product of ref capacities.
- [ ] Product segment shape is checked before writing the parent record.
- [ ] Re-running the same sync is idempotent.
- [ ] Existing same prefix/version with different capacity or refs fails without overwriting.

### US-004: Write Schema Version Records

**Description:** As an index-meta consumer, I want schema version rows created alongside prefix registry rows so that prefix registry and schema version capacity stay aligned.

**Acceptance Criteria:**
- [ ] Sync writes schema version records for every materialized axis leaf prefix.
- [ ] Sync writes a schema version record for the allocation prefix.
- [ ] Schema version capacity matches prefix registry capacity for every written prefix.
- [ ] Existing matching schema version is treated as idempotent no-op.
- [ ] Existing mismatched schema version capacity is reported as capacity drift and not overwritten.
- [ ] Partial prefix/schema records are repaired only if existing records match intended allocation shape.

### US-005: Materialize Sum Allocation as Leaf with Segment Sidecar

**Description:** As an ontology registry operator, I want sum allocations handled safely even though index-meta has no segment model yet.

**Acceptance Criteria:**
- [ ] Sum allocation sync registers allocation prefix/version as a leaf prefix with capacity equal to allocation capacity.
- [ ] Sync writes matching schema version record for the sum allocation prefix.
- [ ] Sync does not write `prefix_ref` rows for sum segments.
- [ ] Sync report includes segment sidecar metadata with range and consumes data.
- [ ] Segment sidecar coverage is validated for range containment, no overlap, and total coverage policy chosen by the handoff spec.
- [ ] Re-running the same sum allocation sync is idempotent.

### US-006: Add Sync Collision and Drift Tests

**Description:** As a registry-service maintainer, I want tests for sync collisions and drift so that index-meta records are not silently overwritten.

**Acceptance Criteria:**
- [ ] Test idempotent product sync retry.
- [ ] Test idempotent sum sync retry.
- [ ] Test product prefix capacity drift fails without overwrite.
- [ ] Test product refs drift fails without overwrite.
- [ ] Test schema version capacity drift fails without overwrite.
- [ ] Test partial matching records can be completed when safe.
- [ ] Test partial mismatched records fail without overwrite.

### US-007: Replace Deferred Sync Report in Service

**Description:** As a registry-service consumer, I want `syncToPrefixRegistry()` to perform real sync while preserving Phase 3 preconditions.

**Acceptance Criteria:**
- [ ] `OntologyRegistryService.syncToPrefixRegistry()` calls the sync adapter for active allocations.
- [ ] Missing and non-active allocation errors remain compatible with Phase 3.
- [ ] Successful report has `syncStatus` representing real sync result, not only `"deferred"`.
- [ ] Report includes written/no-op/repaired/collision summaries.
- [ ] Method does not activate allocations; it only syncs already-active allocations.
- [ ] Existing Phase 3 service tests are updated without weakening precondition coverage.

### US-008: Add Activation Smoke-Level Sync Checks

**Description:** As a future activation smoke implementer, I want minimum post-sync checks available so Phase 5 can prove end-to-end activation without reimplementing sync validation.

**Acceptance Criteria:**
- [ ] Add helper or report fields that confirm prefix registry record exists after sync.
- [ ] Add helper or report fields that confirm schema version capacity exists after sync.
- [ ] For product allocations, verify `getShape(prefix, versionId)` equals ordered axis capacities.
- [ ] For product allocations, verify last valid address index is in range and capacity index is out of range if a resolver helper exists.
- [ ] For sum allocations, verify reported segment sidecar covers the allocation according to the selected sum policy.
- [ ] These checks do not implement full Phase 5 activation helper.

### US-009: Reflect Phase 4 Completion in Docs and TODO

**Description:** As an ontology documentation maintainer, I want Phase 4 completion reflected in specs and TODO so Phase 5 activation smoke starts from stable sync behavior.

**Acceptance Criteria:**
- [ ] Update `operational-ontology-registry-allocation.todo.md` to mark Phase 4 index-meta sync items complete or explicitly deferred.
- [ ] Update `operational-ontology-registry-allocation.spec.md` to summarize sync adapter, product mapping, sum sidecar policy, idempotency, and drift behavior.
- [ ] Update `operational-ontology-index-meta-sync-handoff.spec.md` with implementation refinements and real report shape.
- [ ] Keep Phase 5 activation smoke items open.
- [ ] Update `tasks/prd-ontology-registry-allocation-lifecycle-master.md` with the Phase 5 execution PRD path if it is created.

## Functional Requirements

- FR-1: Sync must only run for active allocations.
- FR-2: Sync must use registry-service allocation bundle as source of truth.
- FR-3: Product allocations must map to index-meta composite prefix DAG records.
- FR-4: Sum allocations must not pretend to have product DAG semantics.
- FR-5: Prefix registry and schema version capacity must match after sync.
- FR-6: Sync retry must be idempotent when records already match.
- FR-7: Sync must not overwrite mismatched existing index-meta records.
- FR-8: Sync must not add scoped prefix behavior.

## Non-Goals

- Adding REST controllers.
- Adding CLI commands.
- Implementing Phase 5 activation helper.
- Adding an index-meta segment table.
- Changing index-meta prefix key shape.
- Changing scoped prefix policy.
- Eagerly materializing every product combination as entries.
- Computing address state/range cache.

## Technical Considerations

- Registry-service inputs:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/stores/ontology-registry-store.ts`
- Index-meta APIs:
  - `packages/index-meta/src/prefix-registry.ts`
  - `packages/index-meta/src/adapters/sql-prefix-registry.ts`
  - `packages/index-meta/src/adapters/memory-prefix-registry.ts`
  - `packages/index-meta/src/adapters/sql-store.ts`
  - `packages/index-meta/src/version-lifecycle.ts`
- Handoff:
  - `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md`

## Success Metrics

- Active product allocation sync creates prefix registry, refs, and schema version records.
- Active sum allocation sync creates leaf prefix/schema version and segment sidecar report.
- Idempotent retry produces no duplicate writes.
- Drift is reported without overwriting existing index-meta records.
- Phase 5 can start with a stable sync report and smoke-check surface.

## Open Questions

- What deterministic axis leaf prefix naming rule should be used?
- Should schema version writes use `IndexMetaStore.insertSchemaVersion()` directly or an existing registry-service abstraction?
- Should sum segment sidecar require exact coverage of the allocation range or only preserve validated segment metadata from the store?
[/PRD]
