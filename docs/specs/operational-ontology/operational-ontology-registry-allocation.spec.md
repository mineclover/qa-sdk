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
  - packages/registry-service/src/modules/ontology/ontology-registry.service.ts
  - packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts
  - packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts
  - packages/registry-service/src/modules/ontology/index-meta-sync.adapter.test.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts
  - packages/registry-service/src/modules/ontology/ontology.module.ts
  - packages/registry-service/src/modules/ontology/ontology.module.test.ts
  - packages/registry-service/src/app.module.ts
  - packages/registry-service/package.json
  - packages/cli/package.json
  - packages/cli/src/commands/ontology.ts
  - packages/cli/src/command-groups/ontology.commands.ts
  - packages/cli/src/lib/activation-evidence-registry.ts
  - packages/operational-ontology/src/programming-artifacts.ts
  - packages/authorization-ontology/src/index.ts
  - tasks/prd-ontology-registry-activation-cli.md
  - tasks/prd-ontology-registry-activation-evidence-persistence.md
---

# Operational Ontology Registry Allocation — 현재 구현 및 검증 계약

## 목적 ^purpose

operational ontology schema를 registry-service와 index-meta가 소비할 수 있는 allocation contract로 고정한다. 목표는 현재 구현된 DB 독립 allocation model, Phase 2A persistence table surface, Phase 2B store adapter surface, Phase 3 service lifecycle surface, Phase 4 index-meta sync surface, Phase 5 activation helper/smoke surface, public/local activation CLI surface, 그리고 CLI activation evidence persistence surface를 plan/todo가 아니라 현재 spec 표면으로 승격하는 것이다.

## 구성 ^overview

현재 완료된 범위는 local allocation contract, handoff 문서화, Phase 2A registry-service persistence table surface, Phase 2B registry-service store adapter surface, Phase 3 registry-service service layer surface, Phase 4 index-meta sync surface, Phase 5 activation helper/smoke surface, local CLI activation execution surface, local activation evidence persistence surface다.

- **Local allocation model** — `OperationalOntologySchema`를 namespace, axis registration, taxonomy registration, address allocation, segment record로 투영한다.
- **Local validation** — 단일 allocation plan 안의 duplicate key, missing axis, invalid size/offset, segment drift를 structured issue로 판정한다.
- **Registry persistence schema** — registry-service가 namespace, axis, taxonomy, allocation, segment rows를 저장할 다섯 개 Drizzle/SQLite table과 migration snapshot을 갖는다.
- **Registry store adapter** — registry-service가 complete allocation plan write와 namespace/axis/taxonomy/allocation/segment read query를 in-memory/SQL adapter parity로 제공한다.
- **Registry service layer** — registry-service가 pack validation, address reservation, activation transition, active allocation sync delegation을 internal service API로 제공한다.
- **Index-meta sync adapter** — active allocation bundle을 index-meta prefix registry/schema version records로 materialize하고 idempotent/repaired/blocked report와 post-sync smoke readback을 반환한다.
- **Activation helper** — ontology module helper가 pack registration, all-allocation activation, index-meta sync, activation-level smoke summary를 service method 호출만으로 조립한다.
- **Activation CLI** — `qa-sdk ontology registry activate-pack <pack-id>`가 completed helper lifecycle을 local SQLite runtime으로 실행하고 stable JSON/text/sidecar output을 제공한다.
- **Activation evidence persistence** — `qa-sdk ontology registry activate-pack <pack-id> --output <file> --artifact-registry <registry>`가 successful activation sidecar를 `kind: "activation-evidence"` programming artifact registry record로 append/upsert한다.
- **Design validation boundary** — ontology design 변경 시 definition graph, operational-ontology allocation, programming-artifact simulation, registry-service/index-meta lifecycle gate를 분리한다.
- **Handoff contracts** — registry-service persistence와 index-meta sync가 소비할 record shape, collision rule, activation smoke 기준을 문서화한다.
- **Prefix policy gate** — scoped prefix 도입 전까지 global `(prefix, versionId)` uniqueness와 현재 registry/index-meta/decode key shape를 유지한다.

## 현재 구현 ^defines

현재 코드 SSOT는 `packages/operational-ontology/src/internal/ontology-allocation-core.ts`다. 공개 표면은 `packages/operational-ontology/src/allocation.ts`와 `packages/operational-ontology/src/schema.ts`에서 export된다.

구현된 타입은 namespace, axis/taxonomy registration, address allocation, segment, policy, issue target, validation result, allocation plan이다. 구현된 함수는 `allocateOntologyAddressSpace(schema, policy)`와 `validateOntologyAddressAllocationPlan(plan)`이다.

registry-service persistence schema SSOT는 `packages/registry-service/src/db/schema.ts`다. Phase 2A migration source는 `packages/registry-service/drizzle/20260414043459_daily_vision/migration.sql`이며, Drizzle schema snapshot은 같은 migration folder의 `snapshot.json`이다.

registry-service store adapter SSOT는 `packages/registry-service/src/stores/ontology-registry-store.ts`다. Shared store validation은 `packages/registry-service/src/stores/ontology-registry-validation.ts`, concrete adapters는 `packages/registry-service/src/stores/in-memory-ontology-registry-store.ts`와 `packages/registry-service/src/stores/sql-ontology-registry-store.ts`, bootstrap exposure는 `packages/registry-service/src/bootstrap/stores.ts`다.

registry-service service layer SSOT는 `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`다. Nest provider wiring은 `packages/registry-service/src/modules/ontology/ontology.module.ts`가 담당하며, `packages/registry-service/src/app.module.ts`가 이 internal module을 import한다.

ontology index-meta sync adapter SSOT는 `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`다. Adapter tests는 product materialization, sum sidecar policy, idempotency, partial repair, collision/drift, and post-sync check report shape를 검증한다.

ontology activation helper SSOT는 `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`다. Helper tests는 valid all-allocation activation, product/sum smoke checks, invalid no-write, duplicate/blocked sync behavior, memory/SQL backend matrix, and public result summary shape를 검증한다.

activation CLI SSOT는 `packages/cli/src/command-groups/ontology.commands.ts`, `packages/cli/src/commands/ontology.ts`, `packages/cli/src/lib/known-ontology-packs.ts`, `packages/cli/src/lib/activation-evidence-registry.ts`, 그리고 `@qa-sdk/registry-service/ontology-local-runtime`이다. CLI tests는 public command path, known pack scenarios, structured failure output, raw SQL sanitization, text output, `--output` JSON sidecar behavior, and `--artifact-registry` activation evidence append behavior를 검증한다.

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

## Service Layer Surface ^service-boundary

Phase 3 adds `OntologyRegistryService` on top of the completed store contract.

- `registerOntologyPack(pack, options)` and object-style `registerOntologyPack({ pack, options })` validate the pack first, derive default `ontologyId` from `pack.packId` unless options override it, project the pack schema into an allocation plan, validate that plan, normalize allocation status to `reserved`, and write the complete plan through `OntologyRegistryStore.writeAllocationPlan()`.
- `reserveAddressSpace({ pack, policy })` delegates through pack registration, while `reserveAddressSpace(schema, policy)` and `reserveAddressSpace({ schema, policy, packId })` project an existing schema/policy pair without pack validation. The service still validates the allocation plan and writes only reserved allocations.
- `activateAllocation(allocationId)` and object-style `activateAllocation({ allocationId })` require an existing allocation with `status: "reserved"`, reject active/deprecated transitions, check active `(prefix, versionId)` collisions via `listActiveAllocations()`, then call `updateAllocationStatus(allocationId, "active")`.
- `syncToPrefixRegistry(allocationId)` and object-style `syncToPrefixRegistry({ allocationId })` require an active allocation, collect namespace/taxonomy/axes/segments from `OntologyRegistryStore`, reorder axes by `taxonomy.axisIds`, and delegate the bundle to `OntologyIndexMetaSyncAdapter`.
- `OntologyModule` exposes the service, `ONTOLOGY_REGISTRY_STORE`, and `ONTOLOGY_INDEX_META_SYNC_ADAPTER` providers internally from the registry-service Nest graph. It uses `DATABASE` to construct `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, and `SqlIndexMetaStore`, and adds no controller, REST route, or CLI command.

Service error code names are part of the Phase 3 handoff contract:

| code | service condition |
|------|-------------------|
| `invalid-pack` | pack validation failed before allocation projection or store write |
| `invalid-allocation-plan` | local allocation validation failed, or store validation rejected a non-duplicate allocation plan |
| `duplicate-allocation` | store duplicate/drift conflict for allocation keys, or active `(prefix, versionId)` collision during activation |
| `invalid-transition` | activation requested from a status other than `reserved` |
| `missing-allocation` | activation or sync references an unknown allocation id |
| `sync-precondition-failure` | sync references an allocation that exists but is not active |

Lifecycle rules are intentionally narrower than future activation smoke:

- Namespace, axis, and taxonomy records remain `lifecycle: "draft"` during reservation.
- Reservation always persists allocation records with `status: "reserved"` even if caller policy supplies another status.
- Activation mutates only allocation `status` from `reserved` to `active`; it does not change namespace, axis, taxonomy, segment, index-meta, or decode state.
- Deprecated allocations cannot be reactivated because only `reserved -> active` is valid.
- Sync does not change allocation lifecycle. It materializes only already-active allocations and reports `synced` or `blocked` index-meta state.

## Index-Meta Sync Surface ^index-meta-sync

Phase 4 adds `OntologyIndexMetaSyncAdapter` under the ontology module boundary. The service-facing method remains `syncToPrefixRegistry()`, but the concrete adapter is now required at service construction and the production Nest module wires the real adapter. Deferred reports remain available only as explicit test fakes for non-sync service tests.

Adapter dependencies are intentionally narrow:

- `PrefixRegistry` for prefix DAG read/write and post-sync resolve/shape readbacks.
- Schema-version store methods `getSchemaVersion(prefix, versionId)` and `insertSchemaVersion(record)`.
- No raw index-meta table access, controller, REST route, or CLI command is part of the adapter contract.

Sync input is an active allocation bundle containing allocation, namespace, taxonomy, ordered axes, and segments. `OntologyRegistryService` owns bundle collection and active-only preconditions; index-meta is not used to infer ontology state.

Product materialization:

- Axis rows are reordered by `taxonomy.axisIds`.
- Each taxonomy axis is written as a deterministic namespace-scoped leaf prefix: `${normalizeIdentifier(namespace)}_axis_${normalizeIdentifier(axisId)}`.
- The allocation prefix is written as a composite `PrefixRegistryRecord` with refs in taxonomy axis order.
- Prefix registry and schema-version records are written for every axis leaf and the allocation parent.
- Parent capacity must match allocation capacity, allocation address size, and the product of axis ref capacities.
- The single product segment must consume exactly `taxonomy.axisIds` in order and match allocation range.
- Axis-value entries and eager product-combination entries are deferred. Product combinations resolve lazily through prefix DAG refs.

Sum materialization:

- The allocation prefix is written as a leaf prefix with `capacity = allocation.capacity`.
- A matching schema-version record is written for the allocation prefix.
- Sum segments are not written as `prefix_ref` rows because index-meta does not own a segment model yet.
- Segment ranges are preserved in `deferredSemantics` sidecar metadata with `coveragePolicy: "exact-allocation-range"`.
- Sidecar coverage is validated before any prefix/schema write: positive integer ranges, non-empty consumes, no overlap, no gaps, no trailing gap, and total covered size equal to allocation address size.

Sync report behavior:

- `syncStatus: "synced"` means every intended prefix/schema target now exists and post-sync checks were collected.
- `syncStatus: "blocked"` means shape/preflight/write drift blocked sync without authorized overwrite.
- `materializedRecords` lists newly written prefix/schema targets.
- `idempotentRecords` lists existing matching prefix/schema targets.
- `repairedRecords` lists missing counterpart records filled only when all existing targets match intended shape.
- `collisions` reports `allocation-shape-drift`, `sum-segment-coverage-drift`, `prefix-capacity-drift`, `prefix-refs-drift`, `schema-version-capacity-drift`, or `index-meta-write-conflict`.
- `deferredSemantics` reports sum segment sidecar semantics until index-meta owns segment rows.
- `postSyncChecks` reports target prefix/schema readbacks, product shape/resolver checks, or sum exact sidecar coverage checks.

Sync is all-or-nothing at the preflight boundary. The adapter builds the full intended target set before writes, reads existing prefix/schema records for every target, and blocks the entire sync if any existing target has capacity/refs/schema drift. Matching subsets can be completed; mismatched subsets block every missing write.

## Activation Helper Surface ^activation-helper

Phase 5 adds `OntologyPackActivationHelper` under the ontology module boundary. The helper is an orchestration helper/provider, not a new store adapter, controller, REST route, or CLI command.

The helper service port is intentionally limited to three `OntologyRegistryService` methods:

- `registerOntologyPack({ pack, options })`
- `activateAllocation({ allocationId })`
- `syncToPrefixRegistry({ allocationId })`

The helper never reaches into registry-service stores, prefix registry stores, index-meta SQL tables, or raw SQL. Store readbacks and SQL table counts are test evidence only; production activation smoke uses activated allocation records plus `syncToPrefixRegistry()` reports.

Activation flow:

1. Convert activation options into register options, including ontology id, namespace, owner, version id, address model, capacity/prefix overrides, and timestamp/now.
2. Call `registerOntologyPack()` so pack validation and allocation-plan validation happen before any reservation write.
3. Iterate every allocation returned by registration. Valid activation is an all-allocation path; the helper does not select a subset.
4. Call `activateAllocation()` for each returned allocation and keep the active allocation record.
5. Call `syncToPrefixRegistry()` for each activated allocation.
6. Convert `blocked` sync reports into activation errors, `deferred` sync reports into warnings, and `synced` reports into activation smoke checks.
7. Return raw detail plus derived summary payloads.

Activation failure policy:

- The helper does not attempt cross-boundary rollback after an allocation has been activated or synced.
- If a later allocation fails after earlier allocations were activated/synced, the result status is `failed`, earlier allocation states remain as recorded, and later allocations are marked `skipped`.
- If sync fails after activation, the activated allocation remains active and the failed sync is reported with `phase: "sync"` in `errors`.
- This policy avoids unsafe rollback across registry-service and index-meta persistence boundaries. Future compensating rollback requires a separate PRD with explicit transaction semantics.

Activation smoke checks consume Phase 4 post-sync reports without reimplementing sync validation:

- Product smoke checks assert source allocation active status, intended product prefix record readback, schema-version capacity matching prefix registry capacity, ordered product shape, last-valid resolver in range, and capacity-address resolver out of range.
- Sum smoke checks assert source allocation active status, intended sum leaf prefix record readback, schema-version capacity matching the sum allocation capacity, and `postSyncChecks.sumAllocation` exact-allocation-range sidecar coverage.
- Sum smoke intentionally does not assert product shape or resolver semantics. Axis `valuesHash` reproduction remains out of scope until axis-value entries are materialized in index-meta.

Activation result payload:

| field | purpose |
|-------|---------|
| `status` | `succeeded` when no activation errors were collected; otherwise `failed` |
| `packId`, `ontologyId` | activation identity |
| `namespaceRecord`, `allocations`, `activationStatuses`, `syncReports`, `smokeChecks` | raw internal detail for debugging and future API surfaces |
| `namespaceSummary` | public namespace summary without requiring callers to inspect raw registration plan shape |
| `allocationSummaries` | allocation records joined with activation/sync status |
| `syncSummariesByAllocationId` | per-allocation materialized/idempotent/repaired/collision/deferred/target counts |
| `smokeCheckSummary` | aggregate and per-allocation check counts |
| `warnings`, `errors` | structured activation issues with phase plus allocation id, taxonomy id, prefix, and version when available |

Unexpected infrastructure errors are sanitized into `unexpected-error` issues with phase and error name only. Raw SQL strings are not exposed in the activation result.

## 검증된 시나리오

현재 allocation/store/service/sync/activation 검증은 아래 시나리오를 닫는다.

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
- registry-service service registers valid packs as reserved namespace/axis/taxonomy/allocation/segment rows and returns allocation validation evidence.
- registry-service service rejects invalid packs before allocation projection or store write.
- registry-service service rejects invalid allocation plans before persistence.
- registry-service service maps duplicate prefix/version and duplicate ontology/taxonomy/version reservations to `duplicate-allocation` conflicts with allocation keys and raw store conflicts preserved.
- registry-service service activation allows only `reserved -> active`, rejects active/deprecated transitions, blocks active prefix/version collisions before store mutation, and leaves index-meta untouched.
- registry-service sync bundle collection preserves taxonomy axis order and segment `consumes`, `addressOffset`, and `addressSize`.
- registry-service sync materializes product allocation axis leaf prefixes, allocation composite refs, and matching schema-version records.
- registry-service sync materializes sum allocation as a leaf prefix/schema target and preserves segment ranges as exact-allocation-range sidecar metadata without `prefix_ref` rows.
- registry-service sync treats matching existing prefix/schema rows as idempotent, repairs missing counterparts when safe, and blocks capacity/refs/schema/segment drift without overwrite.
- registry-service sync post-checks read back target prefix/schema existence, product ordered shape/resolver bounds, and sum sidecar exact coverage.
- registry-service activation helper registers valid packs, activates every returned allocation, syncs every activated allocation, and returns product/sum smoke checks derived from post-sync reports.
- registry-service activation helper rejects invalid packs and invalid allocation plans without registry-service rows or index-meta rows, across memory/SQL backend coverage where applicable.
- registry-service activation helper blocks duplicate active prefix/version activation before allocation status mutation and before index-meta sync writes.
- registry-service activation helper reports blocked index-meta sync without modifying existing index-meta records and preserves collision detail in raw sync reports.
- registry-service activation helper exposes raw detail plus `namespaceSummary`, `allocationSummaries`, `syncSummariesByAllocationId`, and `smokeCheckSummary` for API/CLI consumers.
- registry-service Nest wiring exposes the internal service/store/sync adapter providers without adding `/ontology` routes.
- registry-service Nest wiring exposes the activation helper provider without adding `/ontology` routes.
- CLI command discovery routes `qa-sdk ontology registry activate-pack <pack-id>` through the ontology command group into `cliOntology(["registry.activate-pack", ...])`.
- CLI activation of `programming-artifact-ontology` succeeds through an isolated SQLite store, reports `programming-artifact` and `programming-artifact-relation` allocation summaries, syncs both allocations, and returns passing smoke checks.
- CLI duplicate activation of `programming-artifact-ontology` against the same store returns a structured `duplicate-allocation` helper failure without raw SQL leakage.
- CLI activation of `authorization-ontology` succeeds through an isolated SQLite store, reports all eight authorization taxonomy allocation summaries, syncs every allocation, returns passing smoke checks, and exposes known authorization axes in `syncReports[*].materializedRecords[*].axisId`.
- CLI-origin failures for unknown pack id, invalid flags, invalid address model, runtime storage setup, and output write failures return stable result-like JSON when `--json` or `--output` is used.
- CLI text failures preserve the stable JSON error code as `<code>: <message>`, while helper lifecycle failures continue through activation summary `errors`.
- CLI `--output <file>` writes the same pretty JSON payload as `--json` stdout and creates parent directories before writing.
- CLI `--artifact-registry <registry>` requires `--output <file>`, writes the raw activation sidecar first, and appends managed registry evidence only for `status: "succeeded"` activation results.
- CLI activation evidence uses `kind: "activation-evidence"`, deterministic record id `activation-evidence-<packId>-<ontologyId>`, `artifactRef`/`outputPath` pointing at the sidecar, command provenance in `producedByRef`, pack/import derivation, allocation spec verification, and sidecar/result materialization refs.
- CLI JSON stdout reports additive `activationEvidence` append metadata while the sidecar remains the raw activation helper result.
- CLI registry append failures report sanitized `activation-evidence-registry-append-error`, do not rewrite the sidecar, and set the command exit code to failure.
- Activation evidence registry records validate through `ontology artifact registry validate`, list under `--kind activation-evidence`, and resolve through `ontology prompt extract-artifact <output-file> --artifact-registry <registry>` as `artifact-registry-hit`.
- Successful activation reruns with the same registry/output identity upsert the same evidence record. Duplicate/failed activation against the same store does not append or replace successful evidence.

## 완료된 Handoff Specs

ralph stabilization 작업으로 아래 plan/todo 항목은 spec 문서로 반영됐다.

- `operational-ontology-validation-boundary` — ontology design 변경의 local/lifecycle validation boundary.
- `operational-ontology-design-change-validation-matrix` — 변경 종류별 required docs, owner boundary, tests, commands.
- `operational-ontology-definition-graph-requirements` — ontology module/leaf/plan/todo/knowledge 문서 graph 규칙.
- `operational-ontology-allocation-validation-contract` — local allocation projection/validation 불변조건.
- `operational-ontology-registry-persistence-handoff` — registry-service persistence record mapping과 future tests.
- `operational-ontology-index-meta-sync-handoff` — active allocation의 implemented index-meta sync input, materialization, report shape, idempotency/collision, smoke check 계약.
- `operational-ontology-scoped-prefix-decision` — scoped prefix schema freeze와 decision criteria.

## 구현 경계

Phase 5 및 local CLI exposure 이후 아직 구현하지 않은 범위:

- registry-service REST activation endpoint.
- remote activation service/deployment surface.
- scoped prefix schema/API migration.

Activation result persistence into the local programming artifact registry is complete as a public/local CLI follow-up surface, not an allocation lifecycle phase. REST exposure and remote activation service stay follow-up work. scoped prefix는 `operational-ontology-scoped-prefix-decision`의 concrete need gate와 별도 decision PRD/implementation ADR 없이는 구현하지 않는다. Activation smoke, local CLI execution, and activation evidence persistence are complete and consume Phase 3 active allocation/service error contract, Phase 4 sync report/post-sync check surface, and programming artifact registry helpers without changing table/store/service/sync shape.

## CLI Activation Surface ^cli-activation-surface

The implemented public/local command calls the completed activation helper without reopening lifecycle internals.

- PRD: `tasks/prd-ontology-registry-activation-cli.md`
- JSON: `tasks/prd-ontology-registry-activation-cli.json`
- CLI spec: `operational-ontology-registry-activation-cli`
- command: `qa-sdk ontology registry activate-pack <pack-id>`
- scope: known pack resolver, local SQLite runtime, activation result JSON, text output, `--output` JSON sidecar, explicit `--artifact-registry` activation evidence append, programming-artifact and authorization ontology scenario proofs
- non-goals: registry-service REST endpoint, scoped prefix support, remote activation service

## Activation Evidence Persistence Surface ^activation-evidence-persistence

Activation evidence persistence is a completed public/local follow-up over the activation CLI. It does not reopen Phase 2A/2B persistence, Phase 3 service orchestration, Phase 4 index-meta sync, Phase 5 activation helper/smoke, or Phase 6 scoped prefix policy.

The contract is explicit:

- `--output <file>` materializes the raw activation result sidecar.
- `--artifact-registry <registry>` requires `--output <file>` and appends only successful activation evidence.
- `--output` alone remains sidecar-only.
- Failed activation, duplicate activation against the same store, and output-write failure do not append managed evidence.
- Registry append failure is sanitized, leaves the sidecar unchanged, and is surfaced through additive stdout `activationEvidence.appendStatus: "failed"`.
- The programming artifact record uses `kind: "activation-evidence"` and existing relation vocabulary only.
- Existing artifact registry validate/list/provider lookup handles the evidence; no registry-service REST route or remote activation service is introduced.

## CLI Activation Boundary ^cli-activation-boundary

Phase 5 is the completed internal lifecycle surface: pack validation, reservation, allocation activation, index-meta sync, product/sum smoke checks, and structured activation result payloads. The CLI is a public/local execution surface over that lifecycle, not Phase 6 and not a new lifecycle phase.

The initial known pack resolver must use these package exports, not test fixtures:

| pack id | import contract | source evidence | CLI dependency |
|---------|-----------------|-----------------|----------------|
| `programming-artifact-ontology` | `import { programmingArtifactOntologyPack } from "operational-ontology/programming-artifacts"` | `packages/operational-ontology/package.json` exposes `./programming-artifacts`; `packages/operational-ontology/src/programming-artifacts.ts` re-exports the pack | already covered by `@qa-sdk/cli` dependency on `operational-ontology` |
| `authorization-ontology` | `import { authorizationOntologyPack } from "authorization-ontology"` | `packages/authorization-ontology/package.json` exposes the package root; `packages/authorization-ontology/src/index.ts` exports the pack | `@qa-sdk/cli` has a direct `authorization-ontology` workspace dependency |

The resolved command surface is `qa-sdk ontology registry activate-pack <pack-id>`. The descriptor lives in `packages/cli/src/command-groups/ontology.commands.ts`, routed through the existing ontology handler proxy into `cliOntology` in `packages/cli/src/commands/ontology.ts`.

The confirmed flags are:

- `--store <path>` for persistent local SQLite state.
- `--ontology-id <id>` to override the ontology id passed to registration.
- `--namespace <namespace>` to override the namespace passed to registration.
- `--owner <owner>` to set namespace owner metadata.
- `--version <versionId>` to select allocation version id.
- `--address-model product|sum` to select the allocation model.
- `--prefix <taxonomyId>=<prefix>` as a repeatable deterministic taxonomy prefix override.
- `--output <file>` to write the same pretty JSON payload emitted by `--json` as a sidecar materialization.
- `--artifact-registry <file>` to append successful activation evidence to the local programming artifact registry after the output sidecar is written.
- `--json` for machine-readable activation result output.

The local runtime strategy is a single SQLite file per command invocation. The runtime must open the file through registry-service/index-meta SQL infrastructure, apply index-meta base DDL plus registry-service migrations, and construct all activation dependencies over the same driver: `SqlOntologyRegistryStore` for registry-service ontology rows, `SqlPrefixRegistry` for index-meta prefix records, and `SqlIndexMetaStore` for schema-version records. It then builds `OntologyIndexMetaSyncAdapter`, `OntologyRegistryService`, and `OntologyPackActivationHelper` and calls the helper/service port. It must not start a Nest HTTP server, call registry-service REST APIs, create new persistence abstractions, or reach into raw SQL from the CLI command.

## 검증 명령

현재 spec 반영 작업에서 통과해야 하는 기본 gate:

- `pnpm --filter operational-ontology test -- allocation`
- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `pnpm --filter index-meta test`
- `pnpm --filter index-meta typecheck`
- `pnpm --filter index-meta build`
- `node packages/cli/dist/index.js def validate`

registry-service phase 문서는 `pnpm --filter registry-service typecheck`를 사용할 수 있다. 이 명령은 `packages/registry-service/package.json`의 `typecheck` script가 SSOT다.
