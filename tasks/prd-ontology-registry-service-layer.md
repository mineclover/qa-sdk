[PRD]
# PRD: Ontology Registry Service Layer

## Overview

Implement Phase 3 of the operational ontology registry allocation lifecycle. Phase 2B added the `OntologyRegistryStore` boundary with in-memory and SQL adapters. This PRD adds service-layer orchestration for pack registration, address reservation, allocation activation, lifecycle transition validation, and no-partial-write behavior.

This phase remains internal to registry-service. It does not add REST endpoints, CLI commands, or index-meta sync. `syncToPrefixRegistry()` is limited to a precondition/report shell so Phase 4 can implement real index-meta materialization later.

## Goals

- Add `OntologyRegistryService` over `OntologyRegistryStore`.
- Validate packs with `validateOperationalOntologyPack()` before reservation.
- Project packs into allocation plans with `allocateOntologyAddressSpace()`.
- Persist valid projected plans through the store adapter.
- Enforce reserved/active/deprecated lifecycle transition rules.
- Ensure invalid pack/allocation inputs are no-write failures.
- Provide a Phase 4-ready `syncToPrefixRegistry()` report shell without touching index-meta.
- Reflect Phase 3 completion in docs and TODO.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter registry-service test` - Registry-service test suite
- `pnpm --filter registry-service typecheck` - Registry-service type checking
- `pnpm --filter registry-service build` - Registry-service build
- `pnpm --filter operational-ontology test -- allocation` - Allocation contract regression
- `node packages/cli/dist/index.js def validate` - Definition-catalog validation

No browser verification is required.

## User Stories

### US-001: Define Ontology Registry Service Boundary

**Description:** As a registry-service developer, I want an internal ontology registry service boundary so that lifecycle orchestration is separate from low-level store persistence.

**Acceptance Criteria:**
- [x] Add `packages/registry-service/src/modules/ontology/ontology-registry.service.ts` or a similarly scoped internal service file.
- [x] Define service input/result types for `registerOntologyPack`, `reserveAddressSpace`, `activateAllocation`, and `syncToPrefixRegistry`.
- [x] Define service-level error/conflict types for invalid pack, invalid allocation plan, duplicate allocation, invalid transition, missing allocation, and sync precondition failure.
- [x] The service depends on `OntologyRegistryStore` and does not perform raw SQL directly.
- [x] The service does not expose REST controllers or CLI commands.
- [x] Add `operational-ontology` as a registry-service dependency if needed for pack validation/allocation projection.

### US-002: Implement Pack Registration and Reservation

**Description:** As a registry-service developer, I want pack registration to validate ontology packs and reserve address space so that invalid packs cannot create registry rows.

**Acceptance Criteria:**
- [x] Implement `registerOntologyPack(pack, options)` or equivalent method.
- [x] Method validates the pack with `validateOperationalOntologyPack()` before allocation.
- [x] Method projects the pack/schema into an allocation plan using `allocateOntologyAddressSpace()`.
- [x] Method validates the allocation plan with `validateOntologyAddressAllocationPlan()`.
- [x] Method persists only valid plans through `OntologyRegistryStore.writeAllocationPlan()`.
- [x] Invalid pack or invalid allocation plan leaves no namespace, axis, taxonomy, allocation, or segment rows.
- [x] Default `ontologyId` is `pack.packId` unless an explicit option overrides it.

### US-003: Implement Reserve Address Space API

**Description:** As a registry-service developer, I want a reserve API over existing allocation inputs so that service callers can reserve address space without activating it.

**Acceptance Criteria:**
- [x] Implement `reserveAddressSpace(input)` or equivalent method.
- [x] Method accepts schema/allocation policy inputs compatible with `allocateOntologyAddressSpace()`.
- [x] Reserved allocations are persisted with status `reserved`.
- [x] Duplicate prefix/version and duplicate ontology/taxonomy/version conflicts are surfaced as structured service errors.
- [x] Store errors are mapped without losing conflict details.
- [x] No index-meta records are written.

### US-004: Implement Allocation Activation Rules

**Description:** As a registry-service developer, I want allocation activation rules so that only valid reserved allocations can become active.

**Acceptance Criteria:**
- [x] Implement `activateAllocation(allocationId)` or equivalent method.
- [x] Missing allocation returns a structured missing-allocation error.
- [x] Only `reserved -> active` transition is allowed.
- [x] Deprecated allocations cannot be reactivated.
- [x] Activation is blocked if another active allocation has the same `(prefix, versionId)`.
- [x] Activation updates allocation status through the store boundary or an approved store method added for this transition.
- [x] The method does not call index-meta.

### US-005: Add Sync-To-Prefix-Registry Precondition Shell

**Description:** As a future index-meta sync implementer, I want a sync precondition/report shell so that Phase 4 can attach real sync behavior without changing Phase 3 APIs.

**Acceptance Criteria:**
- [x] Implement `syncToPrefixRegistry(allocationId)` as a precondition/report shell.
- [x] Method requires the allocation to exist and be `active`.
- [x] Method returns a report payload with allocation id, prefix, version id, taxonomy id, status, and `syncStatus` indicating that real index-meta sync is deferred.
- [x] Missing or non-active allocation returns structured service errors.
- [x] Method does not write to index-meta, `prefix_registry`, or `schema_version`.
- [x] Report shape is documented for Phase 4.

### US-006: Add Service-Layer Tests

**Description:** As a registry-service maintainer, I want service tests for pack registration, reservation, activation, and sync preconditions so that lifecycle behavior is fixed before index-meta sync begins.

**Acceptance Criteria:**
- [x] Add `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts` or equivalent tests.
- [x] Test valid pack registration persists namespace, axis, taxonomy, allocation, and segment records.
- [x] Test invalid pack leaves no partial rows.
- [x] Test invalid allocation plan leaves no partial rows.
- [x] Test duplicate prefix/version reserve fails with structured conflict details.
- [x] Test `reserved -> active` succeeds.
- [x] Test missing, active-again, deprecated, and duplicate-active activation paths are rejected.
- [x] Test `syncToPrefixRegistry()` returns deferred sync report for active allocation and rejects non-active allocation.

### US-007: Wire Internal Service into Registry-Service Module Boundary

**Description:** As a registry-service integrator, I want the ontology registry service available inside registry-service so future modules can consume it without exposing public endpoints yet.

**Acceptance Criteria:**
- [x] Add an internal Nest module/provider only if it matches existing registry-service module patterns.
- [x] Provider receives `ontologyStore` from bootstrap/store dependency wiring or a test-friendly factory.
- [x] No REST controller route is added.
- [x] No CLI command is added.
- [x] Existing app/module startup tests continue to pass.
- [x] Add a focused module/provider test if the service is wired through Nest.

### US-008: Reflect Phase 3 Completion in Docs and TODO

**Description:** As an ontology documentation maintainer, I want Phase 3 completion reflected in specs and TODO so that Phase 4 can start from a stable active allocation contract.

**Acceptance Criteria:**
- [x] Update `operational-ontology-registry-allocation.todo.md` to mark Phase 3 service layer items complete.
- [x] Update `operational-ontology-registry-allocation.spec.md` to summarize the service methods and lifecycle rules.
- [x] Update `operational-ontology-registry-persistence-handoff.spec.md` if service error naming refines the handoff contract.
- [x] Keep Phase 4 index-meta sync items open.
- [x] Update `tasks/prd-ontology-registry-allocation-lifecycle-master.md` with the Phase 4 execution PRD path if it is created.

## Functional Requirements

- FR-1: Service methods must consume `OntologyRegistryStore`; raw table access is not allowed in service methods.
- FR-2: Pack registration must validate pack and allocation plan before write.
- FR-3: Invalid inputs must leave no partial ontology rows.
- FR-4: Allocation activation must enforce lifecycle transition rules.
- FR-5: Active allocation uniqueness by `(prefix, versionId)` must be preserved.
- FR-6: `syncToPrefixRegistry()` must not perform real index-meta sync in this phase.
- FR-7: Public REST/CLI exposure is out of scope.

## Non-Goals

- Adding REST controllers.
- Adding CLI commands.
- Implementing index-meta sync.
- Writing `prefix_registry` or `schema_version`.
- Implementing activation smoke decode.
- Changing scoped prefix policy.
- Adding new DB tables.

## Technical Considerations

- Existing examples:
  - `packages/registry-service/src/lib/registry-service.ts`
  - `packages/registry-service/src/modules/services/service-component.service.ts`
  - `packages/registry-service/src/modules/versions/version.service.ts`
  - `packages/registry-service/src/bootstrap/stores.ts`
- Store inputs:
  - `packages/registry-service/src/stores/ontology-registry-store.ts`
  - `packages/registry-service/src/stores/in-memory-ontology-registry-store.ts`
  - `packages/registry-service/src/stores/sql-ontology-registry-store.ts`
- Operational ontology inputs:
  - `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
  - `packages/operational-ontology/src/pack.ts`
  - `packages/operational-ontology/src/allocation.ts`

## Success Metrics

- Valid pack registration creates complete reserved allocation rows.
- Invalid pack/allocation produces no partial rows.
- Activation rules are tested and deterministic.
- Phase 4 can consume an active allocation report without changing Phase 3 service API.

## Open Questions

- Should the service live under `src/modules/ontology` or `src/lib` until public API exposure is decided?
- Should `activateAllocation()` mutate via a new store method or write a revised full plan?
- Should service errors reuse `AppError` or remain ontology-specific until controller exposure exists?
[/PRD]
