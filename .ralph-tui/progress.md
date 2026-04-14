# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Registry-service Drizzle persistence pattern: `packages/registry-service/src/db/schema.ts` is the table SSOT, `drizzle.config.ts` writes source migrations to `packages/registry-service/drizzle`, `src/bootstrap/stores.ts` applies those migrations for SQL drivers, and `tsup.config.ts` copies `drizzle` into `dist`. Existing schema uses snake_case DB names, camelCase TS properties, text `*_json` fields, text ISO timestamps, composite `primaryKey({ columns })` for natural multi-column identities, `idx_...` for non-unique lookup indexes, and `chk_<table>_<field>` for enum checks.
- Operational ontology persistence lifecycle pattern: namespace, axis, and future taxonomy rows use plain text `lifecycle` values `draft | active | deprecated` with Drizzle `check(...)` constraints named `chk_<table>_lifecycle`; optional fields in the operational-ontology handoff model should stay nullable in the registry-service table until a service layer supplies a default.
- Ontology address allocation schema pattern: allocation rows use `allocation_id` as the primary key, unique indexes for `(prefix, version_id)` and `(ontology_id, taxonomy_id, version_id)`, text enum checks for `address_model` (`product | sum`) and `status` (`reserved | active | deprecated`), and no index-meta/address cache behavior. Segment rows use composite `primaryKey({ columns: [allocation_id, segment_id] })` plus `consumes_json` text.
- Registry-service migration generation gotcha: because some existing hand-written migration folders do not include snapshots, `pnpm --filter registry-service db:generate` can include older already-applied table DDL in the generated SQL. Review the generated `migration.sql` and trim unrelated historical churn while keeping the generated snapshot under `drizzle/**`.
- Registry-service migration-backed schema test pattern: use `createRegistryDatabaseDriver(":memory:")` from `src/bootstrap/stores.ts` to apply index-meta plus registry-service migrations, then assert raw SQLite DDL/constraint behavior with direct `SqlDriver` queries/inserts; this avoids coupling schema tests to Nest controllers or registry service/store APIs.
- Operational ontology phase-closure docs pattern: when an implementation phase closes, mark only that phase's `.todo.md` items complete, move the implemented surface into the current `.spec.md` with source references, and keep the handoff doc focused on contract refinements plus still-open adapter/service tests.

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

## 2026-04-14 - US-002
- Added `ontology_namespace` and `ontology_axis` Drizzle table definitions to the registry-service schema.
- Updated the registry-service schema header comment from 8 to 10 documented tables.
- Files changed:
  - `packages/registry-service/src/db/schema.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: ontology namespace uses `ontology_id` as a single text primary key and `uniqueIndex("uq_ontology_namespace_namespace")` for global namespace uniqueness.
  - Patterns discovered: ontology axis follows the natural composite identity pattern with `primaryKey({ columns: [ontology_id, axis_id, version_id] })` and stores ordered values as `values_json` text plus `values_hash`.
  - Gotchas encountered: migration generation is intentionally deferred to US-005, so this story only updates the Drizzle schema SSOT and does not add `drizzle/**` files.
---

## 2026-04-14 - US-003
- Added the `ontology_taxonomy` Drizzle table definition with composite primary key `(ontology_id, taxonomy_id, version_id)`.
- Added taxonomy registration fields `applies_to_json`, `axis_ids_json`, `identity_axis_ids_json`, nullable `space`, and draft/active/deprecated lifecycle check constraint.
- Updated the registry-service schema header comment from 10 to 11 documented tables.
- Verified required gates:
  - `pnpm --filter registry-service test`
  - `pnpm --filter registry-service typecheck`
  - `pnpm --filter registry-service build`
  - `pnpm --filter operational-ontology test -- allocation`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `packages/registry-service/src/db/schema.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: taxonomy rows follow the same natural composite identity as ontology axes, while ordered array membership stays in text JSON columns named with the `*_json` DB convention and camelCase `*Json` Drizzle properties.
  - Gotchas encountered: `axis_ids_json` and `identity_axis_ids_json` cannot practically use DB foreign keys because they are JSON arrays; the schema documents that registry store/service validation must compare those values against `ontology_axis`.
---

## 2026-04-14 - US-004
- Added `ontology_address_allocation` with `allocation_id` primary key, unique `(prefix, version_id)`, unique `(ontology_id, taxonomy_id, version_id)`, address model/capacity/range/status fields, and enum check constraints.
- Added `ontology_address_segment` with composite primary key `(allocation_id, segment_id)`, `consumes_json`, and address range fields.
- Updated the registry-service schema header comment from 11 to 13 documented tables.
- Verified required gates:
  - `pnpm --filter registry-service test`
  - `pnpm --filter registry-service typecheck`
  - `pnpm --filter registry-service build`
  - `pnpm --filter operational-ontology test -- allocation`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `packages/registry-service/src/db/schema.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: allocation table collision guards are represented as explicit `uq_...` unique indexes, while segment identity follows the existing composite primary key pattern.
  - Patterns discovered: allocation status is distinct from namespace/axis/taxonomy lifecycle and uses `reserved | active | deprecated`; `address_model` uses `product | sum` from `operational-ontology` instead of introducing registry-local values.
  - Gotchas encountered: migration generation, SQL schema tests, store adapters, index-meta sync, and `address_state_cache` are intentionally deferred to later stories, so US-004 only changes the Drizzle schema SSOT.
---

## 2026-04-14 - US-005
- Ran `pnpm --filter registry-service db:generate` and added the generated registry-service Drizzle migration/snapshot folder for ontology persistence.
- Scoped the generated SQL migration to the five ontology persistence tables only: namespace, axis, taxonomy, address allocation, and address segment.
- Verified the SQL migration includes unique `(prefix, version_id)` allocation protection plus lifecycle/status/address-model check constraints.
- Verified required gates:
  - `pnpm --filter registry-service test`
  - `pnpm --filter registry-service typecheck`
  - `pnpm --filter registry-service build`
  - `pnpm --filter operational-ontology test -- allocation`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `packages/registry-service/drizzle/20260414043459_daily_vision/migration.sql`
  - `packages/registry-service/drizzle/20260414043459_daily_vision/snapshot.json`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: generated ontology migration SQL should contain only the new ontology DDL and indexes; `dist/drizzle` is copied by build but remains non-source output and should not be included in the committed scope.
  - Patterns discovered: Drizzle snapshot output is a full schema snapshot, while the executable migration SQL must be reviewed for unrelated historical churn before completion.
  - Gotchas encountered: missing snapshots for the existing `service_component_version` hand-written migrations caused drizzle-kit to generate duplicate `service_component_version` create/index SQL, so the new migration SQL was trimmed back to ontology-only changes.
---

## 2026-04-14 - US-006
- Added migration-backed SQL schema tests for the five ontology persistence tables.
- Verified table creation from registry-service migrations and duplicate-key rejection for namespace, axis, taxonomy, allocation, and segment natural identities.
- Verified required gates:
  - `pnpm --filter registry-service test`
  - `pnpm --filter registry-service typecheck`
  - `pnpm --filter registry-service build`
  - `pnpm --filter operational-ontology test -- allocation`
  - `node packages/cli/dist/index.js def validate`
- Files changed:
  - `packages/registry-service/src/ontology-persistence.schema.sql.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: schema-level registry tests can instantiate a migration-initialized `NodeSqliteDriver` with `createRegistryDatabaseDriver(":memory:")` and validate raw SQL constraints without booting Nest or using registry service/store APIs.
  - Patterns discovered: allocation collision tests must vary `allocation_id` and whichever unique key is not under test so the intended unique index is the one that rejects the duplicate.
  - Gotchas encountered: `pnpm --filter registry-service test -- <file>` is not a reliable single-file Vitest filter in this package; use `pnpm --filter registry-service exec vitest run <file>` for targeted verification.
---

## 2026-04-14 - US-007
- Reflected Phase 2A completion in the operational ontology allocation TODO by marking the registry-service schema, migration, snapshot, and schema-test handoff items complete while leaving Phase 2B store adapter items open.
- Updated the current allocation spec with the five-table persisted registry surface and the verified SQL constraint scenarios.
- Refined the persistence handoff spec to treat Phase 2A schema work as implemented and keep remaining test expectations scoped to Phase 2B store adapters and Phase 3 services.
- Files changed:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: implementation phase closure should update the TODO, current spec, and handoff contract together so the next PRD starts at the next open phase instead of rediscovering completed schema work.
  - Gotchas encountered: the persistence handoff was still worded as a future-only contract after Phase 2A schema/tests landed, so the remaining work needed to be split between completed migration-backed SQL coverage and still-open store/service coverage.
---
