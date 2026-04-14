# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- Registry-service store contracts live as narrow dependency-free interface files under `packages/registry-service/src/stores/`; adapter-specific imports such as SQL drivers stay in `in-memory-*`/`sql-*` implementations.
- Ontology registry persistence validation should stay stores-local and dependency-free, returning the structured `OntologyRegistryStoreConflict` shapes before either SQL or in-memory adapters translate them into write failures.

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
