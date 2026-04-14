---
def:
  id: operational-ontology-registry-allocation
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, persistence]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-allocation-validation-contract
      type: depends_on
    - target: operational-ontology-validation-boundary
      type: depends_on
    - target: operational-ontology-design-change-validation-matrix
      type: depends_on
    - target: operational-ontology-definition-graph-requirements
      type: depends_on
    - target: operational-ontology-registry-persistence-handoff
      type: depends_on
    - target: operational-ontology-index-meta-sync-handoff
      type: depends_on
    - target: operational-ontology-scoped-prefix-decision
      type: constrains
    - target: operational-ontology-registry-allocation-plan
      type: traces_to
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/registry-service/src/db/schema.ts
  - packages/registry-service/drizzle/20260414043459_daily_vision/migration.sql
  - packages/registry-service/src/ontology-persistence.schema.sql.test.ts
  - packages/registry-service/src/stores/ontology-registry-store.ts
  - packages/registry-service/src/stores/ontology-registry-validation.ts
  - packages/registry-service/src/stores/in-memory-ontology-registry-store.ts
  - packages/registry-service/src/stores/sql-ontology-registry-store.ts
  - packages/registry-service/src/stores/ontology-registry-store.test.ts
  - packages/registry-service/src/stores/in-memory-ontology-registry-store.test.ts
  - packages/registry-service/src/stores/sql-ontology-registry-store.test.ts
  - packages/registry-service/src/bootstrap/stores.ts
  - packages/registry-service/src/bootstrap/stores.test.ts
  - packages/registry-service/package.json
---

# Operational Ontology Registry Allocation — 현재 구현 및 검증 계약

## 목적 ^purpose

operational ontology schema를 registry-service와 index-meta가 나중에 소비할 수 있는 allocation contract로 고정한다. 목표는 현재 구현된 DB 독립 allocation model, Phase 2A persistence table surface, Phase 2B store adapter surface를 plan/todo가 아니라 현재 spec 표면으로 승격해, 후속 service/index-meta 구현이 안정된 registry store contract를 입력으로 삼게 만드는 것이다.

## 구성 ^overview

현재 완료된 범위는 local allocation contract, handoff 문서화, Phase 2A registry-service persistence table surface, Phase 2B registry-service store adapter surface다.

- **Local allocation model** — `OperationalOntologySchema`를 namespace, axis registration, taxonomy registration, address allocation, segment record로 투영한다.
- **Local validation** — 단일 allocation plan 안의 duplicate key, missing axis, invalid size/offset, segment drift를 structured issue로 판정한다.
- **Registry persistence schema** — registry-service가 namespace, axis, taxonomy, allocation, segment rows를 저장할 다섯 개 Drizzle/SQLite table과 migration snapshot을 갖는다.
- **Registry store adapter** — registry-service가 complete allocation plan write와 namespace/axis/taxonomy/allocation/segment read query를 in-memory/SQL adapter parity로 제공한다.
- **Design validation boundary** — ontology design 변경 시 definition graph, operational-ontology allocation, programming-artifact simulation, registry-service/index-meta lifecycle gate를 분리한다.
- **Handoff contracts** — registry-service persistence와 index-meta sync가 소비할 record shape, collision rule, activation smoke 기준을 문서화한다.
- **Prefix policy gate** — scoped prefix 도입 전까지 global `(prefix, versionId)` uniqueness와 현재 registry/index-meta/decode key shape를 유지한다.

## 현재 구현 ^defines

현재 코드 SSOT는 `packages/operational-ontology/src/internal/ontology-allocation-core.ts`다. 공개 표면은 `packages/operational-ontology/src/allocation.ts`와 `packages/operational-ontology/src/schema.ts`에서 export된다.

구현된 타입은 namespace, axis/taxonomy registration, address allocation, segment, policy, issue target, validation result, allocation plan이다. 구현된 함수는 `allocateOntologyAddressSpace(schema, policy)`와 `validateOntologyAddressAllocationPlan(plan)`이다.

registry-service persistence schema SSOT는 `packages/registry-service/src/db/schema.ts`다. Phase 2A migration source는 `packages/registry-service/drizzle/20260414043459_daily_vision/migration.sql`이며, Drizzle schema snapshot은 같은 migration folder의 `snapshot.json`이다.

registry-service store adapter SSOT는 `packages/registry-service/src/stores/ontology-registry-store.ts`다. Shared store validation은 `packages/registry-service/src/stores/ontology-registry-validation.ts`, concrete adapters는 `packages/registry-service/src/stores/in-memory-ontology-registry-store.ts`와 `packages/registry-service/src/stores/sql-ontology-registry-store.ts`, bootstrap exposure는 `packages/registry-service/src/bootstrap/stores.ts`다.

## Projection Contract

`allocateOntologyAddressSpace()`는 DB 없이 하나의 allocation plan을 만든다.

- 기본 `versionId`는 `v1`이다.
- 기본 lifecycle은 `draft`, allocation status는 `reserved`다.
- 기본 address model은 `product`다.
- namespace는 policy namespace 또는 ontology id를 normalized identifier로 변환한다.
- axis capacity는 policy override, schema capacity, `nextPowerOf2(values.length * 2)` 순서로 결정한다.
- taxonomy마다 allocation 하나를 만든다.
- product allocation은 axis capacity product와 단일 product segment를 만든다.
- sum allocation은 axis capacity sum과 axis별 segment를 만든다.
- allocation id는 `${ontologyId}:${taxonomyId}:${versionId}`다.
- prefix는 policy override가 없으면 `${namespace}_${normalizedTaxonomyId}`다.

## Validation Contract

`validateOntologyAddressAllocationPlan()`은 local plan 내부 불변조건만 판정한다.

error는 빈 ontology id/namespace, 중복 axis/taxonomy registration, 중복 prefix/version allocation, 중복 taxonomy allocation, taxonomy axis registration 누락, identity axis mismatch, allocation size/offset 오류, segment allocation/size/consumes 오류를 포함한다.

warning은 allocation `capacity`와 `addressSize` drift를 포함한다.

issue는 `path`, `code`, `message`와 함께 가능하면 `target`을 가진다. `target`은 prefix, version, taxonomy, axis, allocation, segment id를 담아 후속 registry-service/store validation이 같은 대상을 구조적으로 보고하게 만든다.

## Persisted Registry Table Surface ^persistence-surface

Phase 2A는 allocation contract를 저장하기 위한 registry-service table surface를 닫았다. Phase 2B store adapter는 이 table surface를 소비하며 table shape를 역으로 변경하지 않는다.

| table | persisted concept | key and collision surface |
|-------|-------------------|---------------------------|
| `ontology_namespace` | ontology namespace lifecycle identity | `ontology_id` primary key, unique `namespace`, nullable `owner`, text `lifecycle` check: `draft | active | deprecated` |
| `ontology_axis` | versioned axis registration | composite primary key `(ontology_id, axis_id, version_id)`, ordered `values_json`, `values_hash`, `capacity`, lifecycle check |
| `ontology_taxonomy` | versioned taxonomy registration | composite primary key `(ontology_id, taxonomy_id, version_id)`, `applies_to_json`, `axis_ids_json`, `identity_axis_ids_json`, nullable `space`, lifecycle check |
| `ontology_address_allocation` | taxonomy address allocation lifecycle | `allocation_id` primary key, unique `(prefix, version_id)`, unique `(ontology_id, taxonomy_id, version_id)`, `address_model` check: `product | sum`, `status` check: `reserved | active | deprecated` |
| `ontology_address_segment` | product/sum allocation segment | composite primary key `(allocation_id, segment_id)`, `consumes_json`, `address_offset`, `address_size` |

Phase 2A deliberately keeps taxonomy axis existence, segment range/overlap, lifecycle transition, and no-partial-write validation outside DB foreign keys. Phase 2B store adapters now cover taxonomy axis existence, segment range/overlap, duplicate/drift, and complete allocation plan no-partial-write validation. Lifecycle transition orchestration remains Phase 3 service responsibility.

## Store Adapter Surface ^store-surface

Phase 2B adds `OntologyRegistryStore` as the stable store boundary for Phase 3 service work.

- `writeAllocationPlan(writeSet)` persists one complete namespace/axes/taxonomies/allocations/segments write set.
- Read surface: `listNamespaces()`, `getNamespace(ontologyId)`, `listAxes(ontologyId, versionId)`, `listTaxonomies(ontologyId, versionId)`, `listAllocations(ontologyId, versionId)`, `getAllocation(allocationId)`, `listSegments(allocationId)`, `listActiveAllocations()`.
- Store conflict surface: `duplicate-key`, `drift`, `missing-taxonomy-axis`, `invalid-segment`, `segment-overlap`, and top-level `partial-write-rejected`.
- `partial-write-rejected` wraps the underlying validation conflicts and means the adapter must not persist a partial allocation plan.
- `InMemoryOntologyRegistryStore` validates against a cloned snapshot and returns cloned records to prevent caller mutation from changing store state.
- `SqlOntologyRegistryStore` derives table names from Drizzle schema exports, serializes JSON columns explicitly, validates a full snapshot before insert, wraps inserts in `SqlDriver.transaction()`, and maps SQLite unique constraint races back into structured store conflicts.
- `createRegistryStores()` exposes `ontologyStore` for both `:memory:` and SQL-backed bootstrap modes.

This surface does not expose REST routes, CLI commands, index-meta materialization, or pack activation workflows.

## Remaining Service Layer Responsibilities ^service-boundary

Phase 3 owns the service layer on top of the completed store contract.

- `OntologyRegistryService` must compose `validateOperationalOntologyPack()`, `allocateOntologyAddressSpace()`, `validateOntologyAddressAllocationPlan()`, and `OntologyRegistryStore.writeAllocationPlan()`.
- Invalid packs and invalid allocation plans must be no-write service failures before any namespace/axis/taxonomy/allocation rows are persisted.
- Address reservation must apply allocation collision guards and keep default allocation status as `reserved`.
- Allocation activation must own lifecycle transitions, including reserved-to-active only, deprecated allocation rejection, and active prefix/version duplication checks.
- `syncToPrefixRegistry()` can only close active allocation precondition and audit/report shell until Phase 4 implements index-meta materialization.
- Phase 3 must decide transaction orchestration across pack validation, reservation, and activation workflows when the store adapter transaction only covers a complete `writeAllocationPlan()` call.

Service/controller exposure remains undecided: internal service only, REST endpoint, and CLI-only adapter are still open Phase 3 choices.

## 검증된 시나리오

현재 allocation/store 검증은 아래 시나리오를 닫는다.

- product allocation.
- sum segment allocation.
- duplicate prefix/version allocation.
- missing taxonomy axis.
- structured local allocation drift errors with issue targets.
- registry-service migrations create the five ontology persistence tables.
- registry-service SQL constraints reject duplicate namespace, axis, taxonomy, allocation, and segment natural keys.
- registry-service shared store contract persists complete allocation plans and returns namespace, axis, taxonomy, allocation, active allocation, and segment queries consistently for in-memory and SQL adapters.
- registry-service shared store contract rejects duplicate keys, same-key drift, missing taxonomy axes, invalid segments, out-of-range segments, segment overlap, and partial writes for both adapters.
- registry-service SQL adapter round-trips JSON text columns, rejects pre-write validation failures without partial rows, and maps SQLite unique constraint failures into structured `partial-write-rejected` conflicts.
- registry-service bootstrap exposes `ontologyStore` for `:memory:` and SQL-backed store bundles.

## 완료된 Handoff Specs

ralph stabilization 작업으로 아래 plan/todo 항목은 spec 문서로 반영됐다.

- `operational-ontology-validation-boundary` — ontology design 변경의 local/lifecycle validation boundary.
- `operational-ontology-design-change-validation-matrix` — 변경 종류별 required docs, owner boundary, tests, commands.
- `operational-ontology-definition-graph-requirements` — ontology module/leaf/plan/todo/knowledge 문서 graph 규칙.
- `operational-ontology-allocation-validation-contract` — local allocation projection/validation 불변조건.
- `operational-ontology-registry-persistence-handoff` — registry-service persistence record mapping과 future tests.
- `operational-ontology-index-meta-sync-handoff` — active allocation의 index-meta sync input과 smoke checks.
- `operational-ontology-scoped-prefix-decision` — scoped prefix schema freeze와 decision criteria.

## 구현 경계

Phase 2B 이후 아직 구현하지 않은 범위:

- `OntologyRegistryService`.
- active allocation to index-meta sync.
- pack activation helper and smoke decode.
- scoped prefix schema/API migration.

이 범위는 `operational-ontology-registry-allocation.todo.md`의 Phase 3 이후에 남긴다. Service/index-meta 구현은 Phase 2A table surface와 Phase 2B store surface를 소비해야 하며 table/store shape를 역으로 변경하지 않는다.

## 검증 명령

현재 spec 반영 작업에서 통과해야 하는 기본 gate:

- `pnpm --filter operational-ontology test -- allocation`
- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `node packages/cli/dist/index.js def validate`

registry-service phase 문서는 `pnpm --filter registry-service typecheck`를 사용할 수 있다. 이 명령은 `packages/registry-service/package.json`의 `typecheck` script가 SSOT다.
