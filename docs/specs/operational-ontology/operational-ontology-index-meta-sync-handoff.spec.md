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
---

# Operational Ontology Index-Meta Sync Handoff - active allocation materialization

## 목적 ^purpose

Define the handoff contract a future registry-service sync adapter must use when an active ontology allocation is materialized into index-meta prefix registry and schema version records. The goal is to make the sync input, product/sum mapping, idempotency, collision behavior, and activation smoke checks explicit before any index-meta or registry-service implementation is selected.

## 구성 ^overview

This document is the Phase 4 handoff input for index-meta sync.

- **Sync input** - the active allocation bundle registry-service must pass to index-meta.
- **Materialization mapping** - how product allocation, sum allocation, and segment records map to current index-meta records.
- **Idempotency and collisions** - retry, partial-write, and existing-prefix expectations.
- **Activation smoke** - minimum checks after sync before activation is considered complete.

This story does not add index-meta tables, registry-service services, DB migrations, CLI commands, or sync code. Those changes require a follow-up PRD or implementation story.

## Active Allocation Sync Input ^defines

Only active allocation may be sent to index-meta. The future sync adapter must receive one allocation at a time with enough context to reproduce the intended index-meta records deterministically.

| input group | required data |
|-------------|---------------|
| allocation identity | `allocationId`, `ontologyId`, `taxonomyId`, `prefix`, `versionId`, `addressModel`, `status: "active"` |
| allocation range | `capacity`, `addressOffset`, `addressSize` |
| namespace context | `namespace`, optional `owner`, activation timestamp used as schema record creation time |
| taxonomy context | ordered `axisIds`, `identityAxisIds`, optional `appliesTo`, optional `space` |
| axis refs | for every taxonomy axis in order: `axisId`, `versionId`, `capacity`, `valuesHash`, and the ordered `values` only when entry materialization is requested |
| segments | every `OntologyAddressSegment` for the allocation, preserving `segmentId`, ordered `consumes`, `addressOffset`, and `addressSize` |
| materialization policy | whether to write no entries, axis-value entries, or a later explicit segment model |

The sync adapter must not infer this data from index-meta. Registry-service owns allocation lifecycle and must pass the validated active allocation bundle as the source of truth.

## Phase 3 Deferred Sync Report Shape

Until Phase 4 implements real index-meta materialization, `OntologyRegistryService.syncToPrefixRegistry(allocationId)` is a precondition/report shell. It checks that the allocation exists and has `status: "active"`, but it does not write `prefix_registry`, `schema_version`, `prefix_ref`, entries, or segment materialization rows.

The Phase 3 report payload is the stable handoff shell:

| field | value |
|-------|-------|
| `allocationId` | source `ontology_address_allocation.allocation_id` |
| `prefix` | source allocation prefix intended for future `prefix_registry.prefix` |
| `versionId` | source allocation version intended for future `prefix_registry.version_id` and `schema_version.version_id` |
| `taxonomyId` | source allocation taxonomy id |
| `status` | always `"active"` for successful reports |
| `syncStatus` | `"deferred"` to indicate real index-meta sync is intentionally not implemented in Phase 3 |
| `deferredReason` | `"phase-4-index-meta-sync-not-implemented"` |

Missing allocations return the registry-service `missing-allocation` error. Reserved or deprecated allocations return `sync-precondition-failure` with reason `allocation-not-active`. Phase 4 may replace the deferred implementation behind this same method only after adding the materialization, idempotency, collision, and smoke checks below.

## Product Allocation Mapping

`addressModel: "product"` can be represented with the current index-meta prefix DAG.

- Each consumed ontology axis is materialized as a leaf prefix record before the taxonomy prefix is registered.
- The axis leaf prefix name must be deterministic and collision-checked by registry-service before sync. A follow-up implementation may use an explicit persisted `axisPrefix`; otherwise it must derive one from the allocation namespace and axis id using one documented rule.
- The allocation prefix is materialized as a composite `PrefixRegistryRecord` with `refs` in taxonomy `axisIds` order.
- Parent `PrefixRegistryRecord.capacity` must equal `OntologyAddressAllocation.capacity`, `addressSize`, and the product of ref capacities.
- A matching `schema_version` record must exist for every axis leaf prefix and for the parent taxonomy prefix, with the same capacity as the prefix registry record.
- If axis-value entry materialization is enabled, entries belong only to the axis leaf prefixes. The taxonomy product combinations are decoded lazily through `PrefixRegistryRecord.refs`; they are not eagerly written as one entry row per product combination.

Product allocation segment handling:

- A product allocation normally has one segment whose `consumes` list equals taxonomy `axisIds`.
- That segment is evidence for the parent composite shape. It does not create a separate index-meta segment row in the current schema.
- Segment `addressOffset` and `addressSize` must still be checked against allocation range during smoke validation.

## Sum Allocation Mapping

`addressModel: "sum"` cannot be fully represented as an index-meta composite DAG today because `PrefixRegistryRecord.refs` encodes product shape, while sum segments encode disjoint ranges.

Minimum Phase 4 mapping:

- The allocation prefix is materialized as a leaf `PrefixRegistryRecord` with `capacity = allocation.capacity`.
- A matching `schema_version` record is written for the same `(prefix, versionId, capacity)`.
- Segment records are carried in the sync result or audit report as sidecar materialization metadata.
- `prefix_ref` rows are not written for sum segments unless index-meta adds an explicit segment/sum model in a follow-up story.
- Entry rows are not generated for every address in the sum range. If a later product-like decode is needed for each segment, that is a separate index-meta model change.

Sum allocation smoke must prove the segment sidecar covers the allocation range without overlap. It does not claim recursive prefix decode semantics for each segment until index-meta owns a segment table or equivalent resolver.

## Segment Materialization Boundary

`OntologyAddressSegment` is currently a registry-service allocation artifact, not an index-meta table.

- Product segment materialization means the single product segment is reflected by parent `refs` and capacity checks.
- Sum segment materialization means segment ranges are preserved in audit/sync output but not inserted into `prefix_ref`.
- Future dedicated segment materialization must define an index-meta-owned table or resolver contract before sync code writes segment records into index-meta storage.
- `address_state_cache` and `address_range_cache` are not part of this handoff. They are computed in activation validation or analysis phases after prefix/schema records exist.

## Idempotency Expectations

Sync is idempotent by intended target record shape, not by blind upsert.

- Retrying the same active allocation is a no-op when existing `prefix_registry`, `prefix_ref`, and `schema_version` records exactly match the intended materialization.
- If a previous attempt wrote only part of the target set, the next attempt may repair missing records only when all existing records match the intended allocation shape.
- Existing `schema_version` without matching `prefix_registry`, or the reverse, is partial-sync drift. It may be repaired only after capacity and refs match the same allocation intent.
- Same `(prefix, versionId)` with different capacity, refs, address model, allocation id, ontology id, or taxonomy id is a collision and must fail without overwriting.
- Same axis leaf prefix/version with different `valuesHash` or capacity is drift and must fail without overwriting.
- Capacity expansion uses index-meta lifecycle tooling only when explicitly selected by a future implementation story. This handoff does not authorize implicit `updateCapacity()`.

## Collision Expectations

Registry-service must block known collisions before calling index-meta sync, and index-meta sync must still verify existing records.

- `(prefix, versionId)` remains globally unique until the Phase 6 scoped-prefix decision changes the policy.
- Active allocation for the same `(ontologyId, taxonomyId, versionId)` must be unique before sync.
- Product parent capacity drift is an error when `allocation.capacity`, `allocation.addressSize`, `schema_version.capacity`, `prefix_registry.capacity`, or product refs disagree.
- Sum allocation capacity drift is an error when allocation capacity, allocation address size, schema version capacity, prefix registry capacity, or sum of segments disagree.
- Segment overlap, gaps, negative offsets, zero sizes, or segment ranges outside the allocation range block activation smoke even if index-meta prefix records were written.

## Minimum Activation Smoke Checks

After sync, activation is not complete until the future implementation proves:

1. The source allocation status is `active` and the local allocation validation result has no errors.
2. `PrefixRegistry.getRecord(prefix, versionId)` returns the intended allocation prefix record.
3. `schema_version` contains the same `(prefix, versionId, capacity)` as the prefix registry record.
4. For product allocation, `PrefixRegistry.getShape(prefix, versionId)` equals the ordered axis capacities and the parent capacity equals their product.
5. For product allocation, resolving `prefix:versionId:0` and `prefix:versionId:{capacity - 1}` returns valid addresses.
6. For sum allocation, `PrefixRegistry.getShape(prefix, versionId)` is `[capacity]`, and sidecar segments cover exactly the allocation range without overlap.
7. If axis-value entries were requested, every axis leaf prefix has one-based entry positions matching ordered axis values and the stored values reproduce the handoff `valuesHash`.
8. Address `prefix:versionId:{capacity}` resolves as out-of-range or invalid, never as a valid address.
9. No `address_state_cache` assertion is required for this story.

## Non-Goals

- No index-meta sync implementation.
- No registry-service service, controller, or store implementation.
- No new index-meta segment table, resolver, migration, or `prefix_ref` semantics.
- No eager product-combination entry materialization.
- No address state or range cache calculation.
- No scoped-prefix policy change.
