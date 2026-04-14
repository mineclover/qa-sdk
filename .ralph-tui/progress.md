# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- Registry-service store contracts live as narrow dependency-free interface files under `packages/registry-service/src/stores/`; adapter-specific imports such as SQL drivers stay in `in-memory-*`/`sql-*` implementations.
- Ontology registry persistence validation should stay stores-local and dependency-free, returning the structured `OntologyRegistryStoreConflict` shapes before either SQL or in-memory adapters translate them into write failures.
- Full ontology allocation plan writes should collect validation conflicts first and throw `partial-write-rejected` before mutating adapter state; exact same-key repeats are `duplicate-key`, while changed same-key records are `drift`.
- SQL store adapters can keep raw `SqlDriver` queries while deriving table names from Drizzle schema exports via `getTableName()`, which keeps Phase table names tied to `db/schema.ts` without adopting Drizzle query builders.
- SQL ontology writes should follow snapshot → shared validation → transaction insert, then revalidate/map SQLite unique constraint failures into `partial-write-rejected` conflicts for race/concurrent duplicate cases.

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
