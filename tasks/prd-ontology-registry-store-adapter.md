[PRD]
# PRD: Ontology Registry Store Adapter

## Overview

Implement Phase 2B of the operational ontology registry allocation lifecycle. Phase 2A created registry-service ontology persistence tables, migration, and schema-level SQL tests. This PRD adds the application store boundary that safely reads and writes those records through in-memory and SQL adapters without adding service orchestration, REST routes, CLI commands, or index-meta sync.

The store adapter is the boundary that must close deferred Phase 2A risks: referenced taxonomy axis validation, segment range/overlap validation, duplicate/drift conflict reporting, JSON serialization, and consistent behavior across in-memory and SQL implementations.

## Goals

- Define `OntologyRegistryStore` and persistence record DTOs in registry-service.
- Implement `InMemoryOntologyRegistryStore`.
- Implement `SqlOntologyRegistryStore`.
- Add shared store contract tests for both adapters.
- Validate taxonomy axis references and segment shape/range/overlap at the store boundary.
- Wire the ontology store into registry-service store bootstrap without adding service layer orchestration.
- Reflect Phase 2B completion in docs and TODO.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter registry-service test` - Registry-service test suite
- `pnpm --filter registry-service typecheck` - Registry-service type checking
- `pnpm --filter registry-service build` - Registry-service build
- `pnpm --filter operational-ontology test -- allocation` - Allocation contract regression
- `node packages/cli/dist/index.js def validate` - Definition-catalog validation

No browser verification is required.

## User Stories

### US-001: Define Ontology Registry Store Contract

**Description:** As a registry-service developer, I want a typed ontology registry store contract so that in-memory and SQL adapters expose the same persistence boundary.

**Acceptance Criteria:**
- [ ] Add `packages/registry-service/src/stores/ontology-registry-store.ts`.
- [ ] Define record types for namespace, axis, taxonomy, address allocation, and address segment using camelCase property names.
- [ ] Define write input types that can represent a complete allocation plan write set.
- [ ] Keep the API minimal for Phase 2B: write a complete allocation plan, list namespaces, get namespace, list axes by ontology/version, list taxonomies by ontology/version, list allocations by ontology/version, get allocation, list segments for allocation, and list active allocations.
- [ ] Do not add granular repair/update/delete methods unless a contract test requires them.
- [ ] Define structured conflict/error types for duplicate keys, drift, missing taxonomy axis, invalid segment, segment overlap, and partial write rejection.
- [ ] The contract does not import Nest service classes and does not call index-meta.

### US-002: Add Shared Store Fixtures and Validation Helpers

**Description:** As a registry-service developer, I want shared fixtures and validation helpers so that both stores validate ontology rows the same way.

**Acceptance Criteria:**
- [ ] Add helper code under `packages/registry-service/src/stores/ontology-registry-validation.ts` or a similarly narrow stores-local module.
- [ ] Add reusable fixture builders for namespace, axis, taxonomy, allocation, and segment records.
- [ ] Add helper logic that validates taxonomy axis references against same `ontologyId` and `versionId` axis records.
- [ ] Add helper logic that validates segment `consumes`, positive size, allocation range containment, and segment overlap per allocation.
- [ ] Add helper logic that detects same-key drift for namespace, axis, taxonomy, allocation, and segment records.
- [ ] Helpers are unit tested without requiring SQL.
- [ ] Helpers do not mutate input records.

### US-003: Implement InMemoryOntologyRegistryStore

**Description:** As a registry-service developer, I want an in-memory ontology registry store so that service-layer tests can run without SQL.

**Acceptance Criteria:**
- [ ] Add `packages/registry-service/src/stores/in-memory-ontology-registry-store.ts`.
- [ ] Store supports list/get/write for namespace, axes, taxonomies, allocations, active allocations, and segments.
- [ ] Store enforces namespace uniqueness and all natural key duplicate/drift rules from the handoff spec.
- [ ] Store rejects taxonomy records whose axis references are missing.
- [ ] Store rejects invalid, out-of-range, or overlapping segments.
- [ ] Store write operations are no-op on validation failure; no partial state is retained.
- [ ] Add in-memory store tests for all accepted and rejected cases.

### US-004: Implement SqlOntologyRegistryStore

**Description:** As a registry-service developer, I want a SQL ontology registry store so that ontology allocation records can be persisted through the Phase 2A tables.

**Acceptance Criteria:**
- [ ] Add `packages/registry-service/src/stores/sql-ontology-registry-store.ts`.
- [ ] Store uses the Phase 2A tables from `packages/registry-service/src/db/schema.ts`.
- [ ] Store serializes/deserializes `*_json` text fields explicitly.
- [ ] Store supports list/get/write for namespace, axes, taxonomies, allocations, active allocations, and segments.
- [ ] Store maps SQLite unique constraint failures to structured store conflicts.
- [ ] Store applies the same taxonomy axis and segment validation helpers as the in-memory store before writes.
- [ ] Store write operations use a SQL transaction where possible and leave no partial ontology rows on validation failure.

### US-005: Add Shared Store Contract Tests

**Description:** As a registry-service maintainer, I want one store contract test suite to run against both in-memory and SQL adapters so that behavior cannot drift.

**Acceptance Criteria:**
- [ ] Add `packages/registry-service/src/stores/ontology-registry-store.test.ts` or equivalent contract test file.
- [ ] Test suite runs against `InMemoryOntologyRegistryStore`.
- [ ] Test suite runs against `SqlOntologyRegistryStore` using a migrated SQL driver.
- [ ] Tests cover successful full allocation plan persistence.
- [ ] Tests cover namespace uniqueness and axis/taxonomy/allocation/segment duplicate conflicts.
- [ ] Tests cover same-key drift detection for changed hash/capacity/axis list/prefix/segment shape.
- [ ] Tests cover missing taxonomy axis rejection.
- [ ] Tests cover segment out-of-range and overlap rejection.
- [ ] Tests prove failed writes leave no partial rows.

### US-006: Wire Ontology Store into Registry Store Bootstrap

**Description:** As a registry-service integrator, I want the ontology store available from registry-service bootstrap so that Phase 3 service code can consume it.

**Acceptance Criteria:**
- [ ] Update `packages/registry-service/src/bootstrap/stores.ts` to return `ontologyStore` for `:memory:` stores.
- [ ] Update `packages/registry-service/src/bootstrap/stores.ts` to return `ontologyStore` for SQL-backed stores.
- [ ] The bootstrap change does not expose REST routes, CLI commands, or service orchestration.
- [ ] Existing store bootstrap tests or startup smoke tests continue to pass.
- [ ] Add a focused test if no existing test verifies that `ontologyStore` is present for both modes.

### US-007: Reflect Phase 2B Completion in Docs and TODO

**Description:** As an ontology documentation maintainer, I want Phase 2B completion reflected in specs and TODO so that Phase 3 can start from a stable store contract.

**Acceptance Criteria:**
- [ ] Update `operational-ontology-registry-allocation.todo.md` to mark Phase 2B store adapter items complete.
- [ ] Update `operational-ontology-registry-allocation.spec.md` to summarize the store adapter surface and remaining service-layer responsibilities.
- [ ] Update `operational-ontology-registry-persistence-handoff.spec.md` if store conflict/error naming refines the handoff contract.
- [ ] Keep Phase 3 service layer items open.
- [ ] Add a short note that Phase 3 owns transaction orchestration across pack validation/reservation/activation workflows if not fully closed by store adapter transactions.

## Functional Requirements

- FR-1: Store adapters must consume the Phase 2A table surface without changing table shape.
- FR-2: In-memory and SQL stores must expose the same `OntologyRegistryStore` API.
- FR-3: Stores must reject invalid taxonomy axis references before persisting taxonomy/allocation rows.
- FR-4: Stores must reject invalid, out-of-range, or overlapping segments.
- FR-5: Stores must preserve global `(prefix, versionId)` uniqueness.
- FR-6: Stores must distinguish duplicate same-key writes from same-key drift when possible.
- FR-7: Stores must not call index-meta.
- FR-8: Stores must not implement pack activation workflow.

## Non-Goals

- Implementing `OntologyRegistryService`.
- Implementing `registerOntologyPack`, `reserveAddressSpace`, `activateAllocation`, or `syncToPrefixRegistry`.
- Adding REST endpoints or CLI commands.
- Syncing to index-meta.
- Changing scoped prefix policy.
- Adding new DB tables beyond the Phase 2A persistence schema.

## Technical Considerations

- Keep Phase 2B store API intentionally small. Service-layer repair/update/delete operations belong to Phase 3 if they are needed.
- Prefer SQL transactions for full allocation plan writes. If a transaction helper is unavailable, document the fallback and prove no partial rows with tests.
- Existing store examples:
  - `packages/registry-service/src/stores/prefix-owner-store.ts`
  - `packages/registry-service/src/stores/in-memory-prefix-owner-store.ts`
  - `packages/registry-service/src/stores/sql-prefix-owner-store.ts`
  - `packages/registry-service/src/stores/service-component-version-store.ts`
  - `packages/registry-service/src/stores/sql-service-component-version-store.ts`
- SQL driver/bootstrap:
  - `packages/registry-service/src/bootstrap/stores.ts`
  - `packages/registry-service/src/ontology-persistence.schema.sql.test.ts`
- Contracts:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md`

## Success Metrics

- Both in-memory and SQL stores pass the same contract suite.
- Missing axis, invalid segment, duplicate key, and drift cases are rejected before service layer work begins.
- `createRegistryStores()` exposes `ontologyStore`.
- Phase 3 PRD can focus on service orchestration rather than low-level persistence behavior.

## Open Questions

- Should store writes accept a full allocation plan only, or also support granular table-specific writes for service repair flows?
- Should drift conflicts include the old and new row payload, or only target ids and conflict codes?
- Should SQL store validation run entirely before transaction begin, or run inside one transaction with rollback-on-error?
[/PRD]
