# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- Registry-service store contracts live as narrow dependency-free interface files under `packages/registry-service/src/stores/`; adapter-specific imports such as SQL drivers stay in `in-memory-*`/`sql-*` implementations.

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
