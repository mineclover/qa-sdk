# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- Registry-service store contracts live as narrow dependency-free interface files under `packages/registry-service/src/stores/`; adapter-specific imports such as SQL drivers stay in `in-memory-*`/`sql-*` implementations.
- Phase completion docs should close implemented items in the `.todo.md`, move the implemented source-backed surface into the sibling `.spec.md`, and leave downstream phase ownership explicit instead of marking future orchestration closed.
- Ontology registry persistence validation should stay stores-local and dependency-free, returning the structured `OntologyRegistryStoreConflict` shapes before either SQL or in-memory adapters translate them into write failures.
- Full ontology allocation plan writes should collect validation conflicts first and throw `partial-write-rejected` before mutating adapter state; exact same-key repeats are `duplicate-key`, while changed same-key records are `drift`.
- SQL store adapters can keep raw `SqlDriver` queries while deriving table names from Drizzle schema exports via `getTableName()`, which keeps Phase table names tied to `db/schema.ts` without adopting Drizzle query builders.
- SQL ontology writes should follow snapshot → shared validation → transaction insert, then revalidate/map SQLite unique constraint failures into `partial-write-rejected` conflicts for race/concurrent duplicate cases.
- Registry-service adapter parity tests can live in one `describe.each` store-contract file fed by store factory contexts; keep adapter-specific tests for concerns outside the shared interface such as SQL serialization/race mapping or in-memory defensive copies.
- Registry-service bootstrap parity tests can call `createRegistryStores(":memory:")` and a temporary SQLite path to verify both in-memory and SQL-backed adapters are exposed without wiring REST routes, CLI commands, or orchestration.

---

## 2026-04-14 - US-001
- Implemented the ontology registry store contract for the Phase 2B allocation persistence boundary.
- Added camelCase record/write-set types for namespace, axis, taxonomy, address allocation, and address segment rows.
- Added the minimal store API for complete allocation plan writes and read/list accessors required by the PRD.
- Added structured conflict/error types for duplicate keys, drift, missing taxonomy axes, invalid segments, segment overlap, and partial write rejection.
- Files changed:
  - `packages/registry-service/src/stores/ontology-registry-store.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Phase 2A persistence tables already mirror the operational-ontology allocation DTO names closely, so the store boundary can stay camelCase without database naming leaking into callers.
  - Existing registry-service store contracts are small interface-only files; implementation dependencies belong in the concrete SQL or in-memory adapter files.
  - The current story only needs the shared contract. Validation helpers, adapter behavior, bootstrap wiring, and contract tests are explicitly owned by later Phase 2B stories.
---

## 2026-04-14 - US-002
- Implemented shared ontology registry fixture builders for namespace, axis, taxonomy, allocation, and segment rows.
- Added stores-local validation helpers for same ontology/version taxonomy axis references, segment consumes/size/range/overlap checks, and same-key drift across namespace, axis, taxonomy, allocation, and segment records.
- Added a write-set adapter helper so later store implementations can validate `OntologyAllocationPlanWriteSet` records with existing store context without SQL.
- Added unit tests that exercise the pure helper surface and verify the helpers do not mutate input records.
- Files changed:
  - `packages/registry-service/src/stores/ontology-registry-validation.ts`
  - `packages/registry-service/src/stores/ontology-registry-validation.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Registry-service drift detection needs to cover both primary and secondary natural keys: namespace has `ontologyId` and global `namespace`, while allocation has `allocationId`, `(prefix, versionId)`, and `(ontologyId, taxonomyId, versionId)`.
  - Segment overlap should be checked per allocation with half-open ranges, so adjacent segments are valid while any `current.addressOffset < previousEnd` is a conflict.
  - Taxonomy `identityAxisIds` are also axis references at the persistence boundary, so same `ontologyId` and `versionId` lookup must include the union of `axisIds` and `identityAxisIds`.
---

## 2026-04-14 - US-003
- Implemented `InMemoryOntologyRegistryStore` with write/list/get support for namespaces, axes, taxonomies, allocations, active allocations, and segments.
- Added exact duplicate-key detection to shared ontology registry validation so stores can distinguish duplicate repeats from drift before writes.
- Added in-memory store tests for successful persistence, defensive array copies, duplicate keys, namespace uniqueness drift, natural-key drift, missing taxonomy axes, invalid segments, out-of-range segments, overlap rejection, and no-partial-write behavior.
- Files changed:
  - `packages/registry-service/src/stores/in-memory-ontology-registry-store.ts`
  - `packages/registry-service/src/stores/in-memory-ontology-registry-store.test.ts`
  - `packages/registry-service/src/stores/ontology-registry-validation.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `writeAllocationPlan()` can stay atomic in memory by validating against a cloned snapshot and only committing maps after every conflict check passes.
  - The Phase 2A handoff needs duplicate and drift to be separated: exact natural-key repeats are `duplicate-key`, while changed values on the same natural key remain `drift`.
  - Returning cloned array-backed records avoids mutable fixture/test code leaking into the in-memory store state.
---

## 2026-04-14 - US-004
- Implemented `SqlOntologyRegistryStore` over the Phase 2A ontology tables with list/get/write support for namespaces, axes, taxonomies, allocations, active allocations, and segments.
- Added explicit JSON serialization/deserialization for `values_json`, `applies_to_json`, `axis_ids_json`, `identity_axis_ids_json`, and `consumes_json`.
- Applied shared ontology validation before SQL writes, wrapped writes in `SqlDriver.transaction()`, and mapped SQLite unique constraint failures into structured `partial-write-rejected` store conflicts.
- Added SQL store tests for successful persistence, JSON text round-tripping, no-partial validation failure, and unique constraint conflict mapping.
- Files changed:
  - `packages/registry-service/src/stores/sql-ontology-registry-store.ts`
  - `packages/registry-service/src/stores/sql-ontology-registry-store.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Registry-service SQL stores commonly use `index-meta`'s `SqlDriver` directly; table-name derivation from Drizzle schema exports can keep raw SQL aligned with the Phase 2A schema.
  - Validation failures should happen before opening a write transaction, while SQL uniqueness races still need a catch-and-map path because the database is the final uniqueness boundary.
  - The D1-style `SqlDriver.transaction()` contract may be sequential rather than atomic, so the SQL adapter can guarantee no partial rows on pre-write validation failure and use atomic rollback where the dialect supports transactions.
---

## 2026-04-14 - US-005
- Added a shared ontology registry store contract suite that runs the same behavioral tests against `InMemoryOntologyRegistryStore` and `SqlOntologyRegistryStore`.
- The SQL contract path uses `createRegistryDatabaseDriver(":memory:")`, so registry Drizzle migrations are applied before each SQL adapter test.
- Covered successful complete allocation plan persistence, namespace reuse drift, duplicate keys across namespace/axis/taxonomy/allocation/segment rows, same-key drift for hash/capacity/axis list/prefix/segment shape, missing taxonomy axes, segment out-of-range/overlap, and no-partial-write guarantees.
- Files changed:
  - `packages/registry-service/src/stores/ontology-registry-store.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The shared store interface is sufficient for most adapter parity checks; optional factory context hooks can add backend-specific assertions like raw SQL table counts without leaking SQL into the contract behavior.
  - Existing list methods expose deterministic ordering by natural key/address range, so the contract can assert exact record arrays instead of only checking IDs.
  - Keeping SQL JSON/race tests separate from the shared contract avoids coupling common behavior to adapter-only implementation details.
---

## 2026-04-14 - US-006
- Wired `ontologyStore` into `createRegistryStores()` for both `:memory:` and SQL-backed bootstrap modes.
- Added a focused bootstrap test that verifies `:memory:` returns `InMemoryOntologyRegistryStore` and a temporary SQLite path returns `SqlOntologyRegistryStore`.
- Confirmed the change only touches store bootstrap and tests; no REST routes, CLI commands, or service orchestration were added.
- Files changed:
  - `packages/registry-service/src/bootstrap/stores.ts`
  - `packages/registry-service/src/bootstrap/stores.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `createRegistryStores()` is currently the sole registry-service bootstrap surface for store bundles, so Phase 3 consumers can get new store dependencies by extending this return object.
  - SQL-backed bootstrap tests can use a temporary SQLite file path to exercise the non-`:memory:` branch while leaving schema migration behavior intact.
  - The ontology adapter wiring can remain bootstrap-local; existing modules/routes do not need dependency injection changes until service code begins consuming the store.
---

## 2026-04-14 - US-007
- Reflected Phase 2B completion in the operational ontology registry allocation TODO by marking store adapter items complete and shifting next implementation guidance to Phase 3.
- Updated the allocation spec with the completed store adapter surface, structured conflict list, bootstrap exposure, verified adapter scenarios, and remaining service-layer responsibilities.
- Refined the persistence handoff spec with Phase 2B store conflict/error naming and clarified that Phase 3 owns service/controller decisions.
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Completed implementation phases should be represented twice: checklist closure in the TODO and source-backed contract summary in the sibling spec.
  - Store adapter transactions close complete allocation plan writes, but Phase 3 still needs an explicit service transaction boundary for pack validation, reservation, activation, and sync handoff.
  - Store conflict names are now part of the handoff contract, so service errors should preserve the `OntologyRegistryStoreError.conflict` shape instead of flattening it.
---
