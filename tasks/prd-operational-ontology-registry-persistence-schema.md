[PRD]
# PRD: Operational Ontology Registry Persistence Schema

## Overview

`operational-ontology`의 local allocation model을 registry-service가 저장할 수 있는 persistence schema로 승격한다. 이전 안정화 작업으로 allocation contract, validation boundary, persistence handoff, scoped prefix decision이 정리되었으므로, 이번 PRD는 Phase 2A에 집중한다: registry-service DB schema, migration/schema snapshot, schema-level tests, 문서 반영을 닫는다.

이번 PRD는 store adapter나 service layer를 구현하지 않는다. 목표는 후속 Phase 2B store adapter가 신뢰할 수 있는 DB shape와 constraints를 먼저 고정하는 것이다.

## Repository Pattern Analysis

- `packages/registry-service/src/db/schema.ts`가 Drizzle table SSOT다.
- `packages/registry-service/drizzle.config.ts`는 migration output을 `./drizzle`로 지정한다.
- `packages/registry-service/src/bootstrap/stores.ts`는 runtime DB를 만들 때 `../../drizzle` migration folder를 적용한다.
- `packages/registry-service/tsup.config.ts`는 build 성공 후 `drizzle` folder를 `dist/`로 복사한다.
- Git에서 추적하는 source migration은 `packages/registry-service/drizzle/**`다. `packages/registry-service/dist/**` 산출물은 커밋하지 않는다.
- 기존 schema는 snake_case column names, camelCase TS property names, `*_json` text JSON columns, composite `primaryKey({ columns: [...] })`, `index(...)`, `check(...)` constraints를 사용한다.
- 현재 schema file header는 “8개 테이블”이라고 적혀 있으므로 ontology table 추가 시 header comment도 같이 갱신해야 한다.
- SQL/integration tests는 migration 적용 DB를 전제로 하므로, migration 생성 story가 schema-level SQL tests보다 먼저 완료되어야 한다.

## Goals

- registry-service에 ontology persistence table 5종을 추가한다.
- local allocation model의 namespace, axis, taxonomy, allocation, segment record를 DB row로 저장할 수 있는 shape를 고정한다.
- duplicate/collision constraint를 DB schema 또는 schema-level test로 검증한다.
- global `(prefix, version_id)` uniqueness를 유지한다.
- scoped prefix schema 변경은 하지 않는다.
- Phase 2B store adapter가 소비할 수 있는 persistence foundation을 만든다.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter registry-service test` - Registry-service tests
- `pnpm --filter registry-service typecheck` - Registry-service type checking
- `pnpm --filter registry-service build` - Registry-service build
- `pnpm --filter operational-ontology test -- allocation` - Allocation contract regression
- `node packages/cli/dist/index.js def validate` - Definition-catalog validation

No browser verification is required.

## User Stories

### US-001: Inspect Existing Registry-Service Schema Patterns

**Description:** As a registry-service implementer, I want to document existing Drizzle schema and test patterns so that ontology persistence tables follow the repo's current conventions.

**Acceptance Criteria:**
- [ ] Inspect `packages/registry-service/src/db/schema.ts`, `packages/registry-service/drizzle.config.ts`, `packages/registry-service/tsup.config.ts`, and `packages/registry-service/src/bootstrap/stores.ts`.
- [ ] Identify naming conventions for table names, primary keys, unique indexes, JSON fields, timestamps, lifecycle/status fields, and check constraints.
- [ ] Identify whether the implementation should use composite primary keys or unique indexes for each ontology table.
- [ ] Identify existing SQL/schema tests or migration snapshot patterns.
- [ ] Add brief implementation notes to the ontology registry allocation TODO or a new memo/spec section.
- [ ] Do not add ontology tables in this story.

### US-002: Add Namespace and Axis Tables

**Description:** As a registry-service implementer, I want ontology namespace and axis tables so that registry-service can persist ontology identity and axis registrations.

**Acceptance Criteria:**
- [ ] Add `ontology_namespace` table to `packages/registry-service/src/db/schema.ts`.
- [ ] `ontology_namespace` includes `ontology_id` primary key.
- [ ] `ontology_namespace.namespace` is unique.
- [ ] `ontology_namespace` includes `owner`, `lifecycle`, `created_at`, `updated_at` fields following existing registry-service conventions.
- [ ] Add lifecycle check constraint for allowed namespace lifecycle values.
- [ ] Add `ontology_axis` table.
- [ ] `ontology_axis` has primary key or unique key equivalent to `(ontology_id, axis_id, version_id)`.
- [ ] `ontology_axis` includes `values_json`, `values_hash`, `capacity`, and `lifecycle`.
- [ ] Add lifecycle check constraint for allowed axis lifecycle values.
- [ ] Update the schema file header comment so the documented table count/list includes the new ontology tables.
- [ ] No scoped-prefix fields are added.

### US-003: Add Taxonomy Table

**Description:** As a registry-service implementer, I want an ontology taxonomy table so that taxonomy registration can persist axis composition and identity-axis information.

**Acceptance Criteria:**
- [ ] Add `ontology_taxonomy` table to `packages/registry-service/src/db/schema.ts`.
- [ ] `ontology_taxonomy` has primary key or unique key equivalent to `(ontology_id, taxonomy_id, version_id)`.
- [ ] Table includes `applies_to_json`, `axis_ids_json`, `identity_axis_ids_json`, `space`, and `lifecycle`.
- [ ] Add lifecycle check constraint for allowed taxonomy lifecycle values.
- [ ] Schema leaves referenced-axis existence validation to a documented store/service-level check if DB foreign keys are not practical.
- [ ] JSON field names follow the convention established in US-001.
- [ ] Update the schema file header comment if table count/list changed in this story.

### US-004: Add Allocation and Segment Tables

**Description:** As a registry-service implementer, I want ontology allocation and segment tables so that reserved/active/deprecated address allocation state can be persisted.

**Acceptance Criteria:**
- [ ] Add `ontology_address_allocation` table.
- [ ] `allocation_id` is the primary key.
- [ ] `(prefix, version_id)` is unique.
- [ ] `(ontology_id, taxonomy_id, version_id)` is unique.
- [ ] Table includes `address_model`, `capacity`, `address_offset`, `address_size`, and `status`.
- [ ] Add check constraints for allowed `address_model` and `status` values.
- [ ] Add `ontology_address_segment` table.
- [ ] Segment primary key or unique key is equivalent to `(allocation_id, segment_id)`.
- [ ] Segment includes `consumes_json`, `address_offset`, and `address_size`.
- [ ] Update the schema file header comment so the final table list/count is correct.
- [ ] No index-meta sync or `address_state_cache` behavior is implemented.

### US-005: Generate Migration or Schema Snapshot

**Description:** As a registry-service maintainer, I want the schema migration/snapshot updated before SQL tests run so that the ontology persistence tables are reproducible in local and CI environments.

**Acceptance Criteria:**
- [ ] Run `pnpm --filter registry-service db:generate` or the repo-approved registry-service Drizzle generation command.
- [ ] Generated migration files are placed under `packages/registry-service/drizzle/**`.
- [ ] Commit only source migration files under `packages/registry-service/drizzle/**`; do not commit `packages/registry-service/dist/**` generated output.
- [ ] Generated migration output includes all five ontology persistence tables.
- [ ] Generated output preserves global `(prefix, version_id)` uniqueness.
- [ ] Generated output includes lifecycle/status/address-model check constraints when supported by the existing Drizzle pattern.
- [ ] No unrelated migration churn is introduced.

### US-006: Add Schema-Level Persistence Tests

**Description:** As a registry-service maintainer, I want schema-level tests for ontology persistence so that table creation and uniqueness constraints are verified after migration generation.

**Acceptance Criteria:**
- [ ] Add or extend registry-service schema/SQL tests for the five ontology persistence tables.
- [ ] Tests run against a DB initialized from registry-service migrations, not only `schema.ts` metadata.
- [ ] Test namespace uniqueness.
- [ ] Test axis duplicate key rejection for `(ontology_id, axis_id, version_id)`.
- [ ] Test taxonomy duplicate key rejection for `(ontology_id, taxonomy_id, version_id)`.
- [ ] Test allocation duplicate key rejection for `(prefix, version_id)`.
- [ ] Test allocation duplicate key rejection for `(ontology_id, taxonomy_id, version_id)`.
- [ ] Test segment duplicate key rejection for `(allocation_id, segment_id)`.
- [ ] Tests do not require `OntologyRegistryStore` or `OntologyRegistryService`.

### US-007: Reflect Phase 2A Completion in Docs and TODO

**Description:** As an ontology documentation maintainer, I want Phase 2A completion reflected in spec/todo docs so that the next PRD can start at store adapter work.

**Acceptance Criteria:**
- [ ] Update `operational-ontology-registry-allocation.todo.md` to mark Phase 2A schema and migration/snapshot items complete.
- [ ] Update `operational-ontology-registry-allocation.spec.md` to summarize the persisted table surface.
- [ ] Update `operational-ontology-registry-persistence-handoff.spec.md` only if implementation choices refine the handoff contract.
- [ ] Keep Phase 2B store adapter items open.
- [ ] `node packages/cli/dist/index.js def validate` passes.

## Functional Requirements

- FR-1: Registry-service must define five ontology persistence tables: namespace, axis, taxonomy, address allocation, address segment.
- FR-2: The schema must preserve local allocation model field names semantically, even if DB column naming follows snake_case.
- FR-3: The schema must enforce uniqueness for namespace, axis, taxonomy, allocation, and segment identities.
- FR-4: The schema must keep `(prefix, version_id)` globally unique.
- FR-5: The schema must not introduce scoped prefix columns or change existing prefix table identity.
- FR-6: The schema must not implement index-meta sync.
- FR-7: The schema must not implement store adapter or service layer behavior.
- FR-8: Migration generation must precede SQL persistence tests.

## Non-Goals

- Implementing `OntologyRegistryStore`.
- Implementing `InMemoryOntologyRegistryStore`.
- Implementing `SqlOntologyRegistryStore`.
- Implementing `OntologyRegistryService`.
- Implementing `registerOntologyPack`, `reserveAddressSpace`, `activateAllocation`, or `syncToPrefixRegistry`.
- Syncing active allocation to index-meta.
- Changing `/prefixes/:prefix`, index-meta keys, or decode-service cache keys.
- Adding scoped prefix support.
- Committing generated `dist/` output.

## Technical Considerations

- Primary implementation file: `packages/registry-service/src/db/schema.ts`.
- Migration output: `packages/registry-service/drizzle/**`.
- Build copies migrations to `dist/drizzle`; source commits should stay under `drizzle/**`.
- Existing package scripts:
  - `pnpm --filter registry-service test`
  - `pnpm --filter registry-service typecheck`
  - `pnpm --filter registry-service build`
  - `pnpm --filter registry-service db:generate`
- Source contracts:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-scoped-prefix-decision.spec.md`
  - `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
- If existing registry-service DB tests use a specific SQLite setup/helper, reuse it instead of introducing a new test harness.

## Success Metrics

- Registry-service schema contains the five ontology persistence tables.
- Migration output under `packages/registry-service/drizzle/**` creates those tables.
- Duplicate/collision constraints are covered by tests.
- `registry-service typecheck/test/build` pass.
- `operational-ontology allocation` regression passes.
- `def validate` passes.
- Phase 2A TODO items are complete while Phase 2B remains open.

## Open Questions

- Should referenced axis existence be enforced via DB foreign keys or store/service validation?
- Should lifecycle/status fields be plain text columns with `check(...)` constraints, matching current schema style?
- Should later migrations continue the current folder-per-migration pattern without per-migration snapshot files, or should snapshots be restored for every generated migration?
[/PRD]
