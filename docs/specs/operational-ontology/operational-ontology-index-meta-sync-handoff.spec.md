---
def:
  id: operational-ontology-index-meta-sync-handoff
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, testing, cross-scope]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-allocation-validation-contract
      type: depends_on
    - target: operational-ontology-registry-persistence-handoff
      type: depends_on
    - target: operational-ontology-registry-allocation-plan
      type: depends_on
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
    - target: index-meta-system
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/index-meta/src/prefix-registry.ts
  - packages/index-meta/src/schema-sync.ts
  - packages/index-meta/src/version-lifecycle.ts
  - packages/index-meta/src/db/schema.ts
  - packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts
  - packages/registry-service/src/modules/ontology/index-meta-sync.adapter.test.ts
  - packages/registry-service/src/modules/ontology/ontology-registry.service.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
  - packages/registry-service/src/modules/ontology/ontology.module.ts
---

# Operational Ontology Index-Meta Sync Handoff - implemented active allocation materialization

## 목적 ^purpose

Define the implemented handoff contract `OntologyRegistryService.syncToPrefixRegistry()` uses when an active ontology allocation is materialized into index-meta prefix registry and schema version records. The goal is to keep the sync input, product/sum mapping, idempotency, collision behavior, report shape, and activation smoke check surface explicit now that Phase 4 sync and Phase 5 helper consumption are complete.

## 구성 ^overview

This document is the Phase 4 implementation contract for index-meta sync and the Phase 5 input consumed by activation smoke.

- **Sync input** - the active allocation bundle registry-service passes to the ontology sync adapter.
- **Materialization mapping** - how product allocation, sum allocation, and segment records map to current index-meta records and report sidecars.
- **Report shape** - real `synced`/`blocked` reports plus explicit deferred fake shape for tests.
- **Idempotency and collisions** - retry, partial repair, preflight, and existing-prefix behavior.
- **Activation smoke surface** - post-sync readback fields the activation helper consumes without reimplementing sync validation.

This contract does not add REST routes, CLI commands, scoped prefix behavior, an index-meta segment table, eager product entries, or activation orchestration inside the sync adapter.

## Active Allocation Sync Input ^defines

Only active allocation may be sent to index-meta. The sync adapter receives one allocation at a time with enough context to reproduce the intended index-meta records deterministically.

| input group | required data |
|-------------|---------------|
| allocation identity | `allocationId`, `ontologyId`, `taxonomyId`, `prefix`, `versionId`, `addressModel`, `status: "active"` |
| allocation range | `capacity`, `addressOffset`, `addressSize` |
| namespace context | `namespace`, optional `owner`, activation timestamp used as schema record creation time |
| taxonomy context | ordered `axisIds`, `identityAxisIds`, optional `appliesTo`, optional `space` |
| axis refs | for every taxonomy axis in order: `axisId`, `versionId`, and `capacity`; `valuesHash` and ordered `values` remain source axis metadata and are only actionable when future entry materialization is requested |
| segments | every `OntologyAddressSegment` for the allocation, preserving `segmentId`, ordered `consumes`, `addressOffset`, and `addressSize` |
| materialization policy | whether to write no entries, axis-value entries, or a later explicit segment model |

The sync adapter must not infer this data from index-meta. Registry-service owns allocation lifecycle and passes the validated active allocation bundle as the source of truth. `OntologyRegistryService` also reorders store-loaded axes by `taxonomy.axisIds` because store adapters return stable storage order, not necessarily taxonomy order.

## Implemented Adapter Boundary

`OntologyIndexMetaSyncAdapter` lives under `packages/registry-service/src/modules/ontology/` and keeps index-meta details inside the ontology module. Production `OntologyRegistryService` requires an injected adapter at construction; the Nest module wires the real adapter with `SqlPrefixRegistry` and `SqlIndexMetaStore`.

Adapter dependencies are intentionally type-first and narrow:

| dependency | used for |
|------------|----------|
| `PrefixRegistry` | read existing prefix records, register intended prefix records, collect shape/resolve post-sync checks |
| schema-version store `getSchemaVersion()` | preflight existing schema capacity |
| schema-version store `insertSchemaVersion()` | write missing schema capacity rows |

The service-facing method remains `syncToPrefixRegistry(allocationId | { allocationId })`. It rejects missing allocations with `missing-allocation`, rejects reserved/deprecated allocations with `sync-precondition-failure`, collects namespace/taxonomy/axes/segments, and then returns the adapter report.

## Report Shape

The real Phase 4 report payload is:

| field | value |
|-------|-------|
| `allocationId` | source `ontology_address_allocation.allocation_id` |
| `prefix` | source allocation prefix materialized into `prefix_registry.prefix` |
| `versionId` | source allocation version materialized into `prefix_registry.version_id` and `schema_version.version_id` |
| `taxonomyId` | source allocation taxonomy id |
| `status` | always `"active"` for successful reports |
| `syncStatus` | `"synced"` when intended targets exist after sync; `"blocked"` when validation/preflight/write drift prevented sync |
| `materializedRecords` | newly written prefix/schema targets |
| `idempotentRecords` | existing prefix/schema targets that already matched intended shape |
| `repairedRecords` | missing prefix/schema counterparts written only when all existing counterparts matched |
| `collisions` | structured drift/write blockers; empty on `synced` reports |
| `deferredSemantics` | sum segment sidecar semantics until index-meta owns a segment model |
| `postSyncChecks` | target prefix/schema readbacks plus product or sum smoke-level readbacks |

`buildDeferredOntologyIndexMetaSyncReport()` still exists for explicit tests that are not exercising sync. That report has `syncStatus: "deferred"` and `deferredReason: "phase-4-index-meta-sync-not-implemented"` or `"sum-segment-semantics-unsupported"`. Production service construction no longer falls back to this deferred shell.

Record roles and kinds are intentionally small:

- `kind`: `prefix-registry`, `schema-version`, or `segment-sidecar`.
- `role`: `axis-leaf`, `allocation-prefix`, or `sum-segment-sidecar`.
- Records include prefix, version, capacity, optional axis id, optional segment id/range/consumes, and optional refs.

Collision codes are `prefix-capacity-drift`, `prefix-refs-drift`, `schema-version-capacity-drift`, `allocation-shape-drift`, `sum-segment-coverage-drift`, and `index-meta-write-conflict`.

## Product Allocation Mapping

`addressModel: "product"` can be represented with the current index-meta prefix DAG.

- Each consumed ontology axis is materialized as a leaf prefix record before the taxonomy prefix is registered.
- The axis leaf prefix name is deterministic: `${normalizeIdentifier(namespace)}_axis_${normalizeIdentifier(axisId)}`.
- Phase 4 axis leaf records persist only the current index-meta surface: `(prefix, versionId, capacity)` in `prefix_registry` and `schema_version`.
- The allocation prefix is materialized as a composite `PrefixRegistryRecord` with `refs` in taxonomy `axisIds` order.
- Parent `PrefixRegistryRecord.capacity` must equal `OntologyAddressAllocation.capacity`, `addressSize`, and the product of ref capacities.
- A matching `schema_version` record must exist for every axis leaf prefix and for the parent taxonomy prefix, with the same capacity as the prefix registry record.
- Axis-value entry materialization is deferred. If it is enabled later, entries belong only to the axis leaf prefixes. The taxonomy product combinations are decoded lazily through `PrefixRegistryRecord.refs`; they are not eagerly written as one entry row per product combination.
  At that point, ordered axis values must reproduce the source axis `valuesHash`. Until then, `valuesHash` is not persisted in index-meta and cannot be used as a Phase 4 sync drift signal.

Product allocation segment handling:

- A product allocation normally has one segment whose `consumes` list equals taxonomy `axisIds`.
- That segment is evidence for the parent composite shape. It does not create a separate index-meta segment row in the current schema.
- Segment `addressOffset` and `addressSize` must still be checked against allocation range during smoke validation.

## Sum Allocation Mapping

`addressModel: "sum"` cannot be fully represented as an index-meta composite DAG today because `PrefixRegistryRecord.refs` encodes product shape, while sum segments encode disjoint ranges.

Phase 4 mapping:

- The allocation prefix is materialized as a leaf `PrefixRegistryRecord` with `capacity = allocation.capacity`.
- A matching `schema_version` record is written for the same `(prefix, versionId, capacity)`.
- Segment records are carried in the sync result as sidecar materialization metadata.
- `prefix_ref` rows are not written for sum segments unless index-meta adds an explicit segment/sum model in a follow-up story.
- Entry rows are not generated for every address in the sum range. If a later product-like decode is needed for each segment, that is a separate index-meta model change.

Sum allocation smoke-level checks prove the reported segment sidecar covers the allocation range without overlap. They do not claim recursive prefix decode semantics for each segment until index-meta owns a segment table or equivalent resolver.

## Segment Materialization Boundary

`OntologyAddressSegment` is currently a registry-service allocation artifact, not an index-meta table.

- Product segment materialization means the single product segment is reflected by parent `refs` and capacity checks.
- Sum segment materialization means segment ranges are preserved in sync output but not inserted into `prefix_ref`.
- Future dedicated segment materialization must define an index-meta-owned table or resolver contract before sync code writes segment records into index-meta storage.
- `address_state_cache` and `address_range_cache` are not part of this handoff. They are computed in activation validation or analysis phases after prefix/schema records exist.

## Idempotency Expectations

Sync is idempotent by intended target record shape, not by blind upsert.

- Retrying the same active allocation is a no-op when existing `prefix_registry`, `prefix_ref`, and `schema_version` records exactly match the intended materialization.
- If a previous attempt wrote only part of the target set, the next attempt may repair missing records only when all existing records match the intended allocation shape.
- Existing `schema_version` without matching `prefix_registry`, or the reverse, is partial-sync drift. It may be repaired only after capacity and refs match the same allocation intent.
- Same `(prefix, versionId)` with different capacity, refs, address model, allocation id, ontology id, or taxonomy id is a collision and must fail without overwriting.
- Same axis leaf prefix/version with different persisted capacity is drift and must fail without overwriting. Parent composite records also detect ordered `refs` drift. `valuesHash` drift is enforced by registry-service ontology axis persistence, not by current Phase 4 index-meta sync, because index-meta does not store axis values or their hash.
- Capacity expansion uses index-meta lifecycle tooling only when explicitly selected by a future implementation story. This handoff does not authorize implicit `updateCapacity()`.
- The adapter builds and preflights the full intended prefix/schema target set before any write. Any mismatched existing target blocks every missing write.

## Collision Expectations

Registry-service blocks known lifecycle collisions before calling index-meta sync, and index-meta sync still verifies existing records.

- `(prefix, versionId)` remains globally unique until the Phase 6 scoped-prefix decision changes the policy.
- Active allocation for the same `(ontologyId, taxonomyId, versionId)` must be unique before sync.
- Product parent capacity drift is an error when `allocation.capacity`, `allocation.addressSize`, `schema_version.capacity`, `prefix_registry.capacity`, or product refs disagree.
- Sum allocation capacity drift is an error when allocation capacity, allocation address size, schema version capacity, prefix registry capacity, or sum of segments disagree.
- Segment overlap, gaps, negative offsets, zero sizes, or segment ranges outside the allocation range block sync before index-meta prefix records are written.

## Post-Sync Smoke-Level Checks

Phase 4 reports post-sync readbacks. Phase 5 activation smoke consumes those readbacks through `OntologyPackActivationHelper`; the sync adapter still does not perform pack activation orchestration.

A successful `synced` report provides:

1. `targetRecords[]`: for every intended target, whether prefix registry record exists, whether prefix capacity matches, whether schema version exists, and whether schema capacity matches.
2. Product allocation checks: expected ordered axis capacities, actual `PrefixRegistry.getShape(prefix, versionId)`, shape match flag, last-valid address resolver check at `capacity - 1`, and out-of-range resolver check at `capacity`.
3. Sum allocation checks: sidecar `coveragePolicy`, allocation range, covered size, segment list, and exact allocation range coverage flag.

Activation-level responsibility split:

- `OntologyIndexMetaSyncAdapter` owns target prefix/schema readbacks, product shape/resolver checks, sum sidecar coverage, idempotency, and drift/collision reporting.
- `OntologyPackActivationHelper` owns source allocation active-status assertions, conversion of blocked sync reports into activation errors, conversion of deferred reports into warnings, per-allocation smoke check assembly, and aggregate smoke summaries.
- No helper-level smoke check should query prefix registry stores, index-meta stores, or SQL directly. Tests may use store APIs and SQL table counts only as no-write evidence for invalid or blocked paths.

These fields are sufficient for activation smoke over the Phase 4 materialization surface: active allocation status is checked from registry-service activation results, target prefix/schema presence and capacity are in `targetRecords[]`, product decode bounds are in `productAllocation`, and sum segment coverage is in `sumAllocation`.

Activation smoke must not assert axis `valuesHash` reproduction unless a future story implements axis-value entry materialization in index-meta. If axis-value entries are requested later, every axis leaf prefix must define one-based entry positions matching ordered axis values and stored values must reproduce the handoff `valuesHash`.

No `address_state_cache` or `address_range_cache` assertion is required for Phase 4 sync or Phase 5 activation smoke.

## Non-Goals

- No activation orchestration inside the sync adapter.
- No registry-service controller, REST route, or CLI command.
- No new index-meta segment table, resolver, migration, or `prefix_ref` semantics.
- No eager product-combination entry materialization.
- No axis-value entry materialization.
- No address state or range cache calculation.
- No scoped-prefix policy change.
