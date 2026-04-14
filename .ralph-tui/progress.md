# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Registry-service Drizzle persistence pattern: `packages/registry-service/src/db/schema.ts` is the table SSOT, `drizzle.config.ts` writes source migrations to `packages/registry-service/drizzle`, `src/bootstrap/stores.ts` applies those migrations for SQL drivers, and `tsup.config.ts` copies `drizzle` into `dist`. Existing schema uses snake_case DB names, camelCase TS properties, text `*_json` fields, text ISO timestamps, composite `primaryKey({ columns })` for natural multi-column identities, `idx_...` for non-unique lookup indexes, and `chk_<table>_<field>` for enum checks.

---

## 2026-04-14 - US-001
- Implemented registry-service schema pattern inspection notes for ontology persistence Phase 2A without adding ontology tables.
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: registry-service stores JSON as text `*_json`, keeps timestamp columns as text ISO strings, uses single text primary keys or composite primary keys for natural identities, and names check constraints as `chk_<table>_<field>`.
  - Patterns discovered: ontology table identity should use composite primary keys for axis, taxonomy, and segment rows; namespace and allocation should use single primary keys plus secondary unique constraints for namespace text and allocation collision keys.
  - Gotchas encountered: existing registry-service has no secondary unique-index examples, so Phase 2A should choose explicit `uq_<table>_<columns>` names and verify generated SQLite SQL; later migrations currently lack per-migration snapshots except the initial snapshot.
---
