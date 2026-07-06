---
def:
  id: operational-ontology-scoped-prefix-decision
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [decision, structural, contract, cross-scope]
  links:
    - target: operational-ontology-system
      type: traces_to
    - target: operational-ontology-registry-allocation-plan
      type: traces_to
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
    - target: operational-ontology-registry-persistence-handoff
      type: constrains
    - target: operational-ontology-index-meta-sync-handoff
      type: constrains
    - target: registry-system
      type: constrains
    - target: index-meta-system
      type: constrains
  sources:
    - packages/operational-ontology/src/internal/ontology-allocation-core.ts
    - packages/operational-ontology/src/allocation.test.ts
    - packages/cli/src/commands/ontology/activation.ts
    - docs/specs/operational-ontology/operational-ontology-registry-persistence-handoff.spec.md
---

# Operational Ontology Scoped Prefix Decision - namespace change criteria

## 목적 ^purpose

Define the decision criteria for keeping registry prefixes globally unique versus introducing catalog-, ontology-, tenant-, or pack-scoped prefix namespaces. The goal is to prevent registry-service prefix namespace changes until a concrete collision need is proven and every address/decode surface has an accepted migration plan.

## 구성 ^overview

This ADR is the Phase 6 prefix policy decision gate for registry allocation.

- **Default policy** - keep `registry-service.prefix.prefix` globally unique and keep `(prefix, versionId)` as the active allocation collision key.
- **Evidence gate** - scoped prefixes require non-renamable, concurrently active collisions that cannot be solved by allocation namespace or deterministic prefix naming.
- **Scenario matrix** - catalog id, ontology id, tenant boundary, and pack collision cases are evaluated separately.
- **Affected surfaces** - `/prefixes/:prefix`, index-meta key shape, decode-service/cache keys, and migration plan are mandatory before schema change.

This document does not change registry-service schema, index-meta schema, decode-service cache format, API routes, or runtime behavior.

## Current Freeze ^defines

Until this decision is resolved into an implementation ADR, the registry-service `prefix` table schema must not change.

- Do not add `catalog_id`, `ontology_id`, `tenant_id`, `pack_id`, or scope discriminator columns to `registry-service.prefix`.
- Do not change the `prefix` table primary key away from global `prefix`.
- Do not change `/prefixes/:prefix` to mean a scoped lookup.
- Do not change index-meta primary keys from `(prefix, version_id)`.
- Do not change decode-service decoder-pool or L2 cache keys from prefix/version semantics.

Phase 2A/2B registry allocation work may still add `ontology_address_allocation` collision guards. Those guards preserve global `(prefix, versionId)` uniqueness while scoped-prefix evidence is gathered.

## Decision Criteria

Retain global prefix uniqueness when all of the following are true:

1. A collision can be removed by renaming one prefix with a deterministic registry naming rule.
2. Only one active allocation for `(prefix, versionId)` is needed across registry-service and index-meta.
3. The prefix name is an address/decode identity, not merely a display label.
4. Tenancy, catalog channel, or pack ownership can be represented in metadata, owner fields, allocation namespace, or axis values without changing decode identity.
5. Existing consumers use `/prefixes/:prefix`, index-meta `(prefix, version_id)`, or decode cache keys without passing a scope id.

Introduce scoped prefixes only when all of the following are proven:

1. Two or more allocations must be concurrently active with the same prefix and version text.
2. The colliding prefixes have different capacity, refs, address model, ontology meaning, or decode result and cannot share an index-meta record.
3. Renaming would break an external contract, imported pack compatibility, tenant isolation contract, or catalog publication guarantee.
4. The chosen scope id is stable, finite, and already present on every producer and consumer path.
5. A migration plan exists for API, index-meta storage, decode-service keys, cache invalidation, and legacy route compatibility.

If any scoped-prefix criterion is missing, the decision remains global uniqueness plus explicit collision errors.

## Scenario Matrix

| scenario | keep global uniqueness | scoped-prefix evidence |
|----------|------------------------|------------------------|
| Catalog id | Same semantic prefix is published through multiple catalog channels, or catalog id only selects a delivery bundle. | Two catalogs must publish the same `prefix/versionId` text with different capacity, refs, or decode meaning, and consumers cannot accept renamed prefixes. Candidate scope: `(catalog_id, prefix)`. |
| Ontology id | Ontology id identifies namespace ownership but active allocations can use deterministic global prefix names such as `{namespace}_{taxonomy}`. | Two ontology namespaces must independently own the same prefix text with different taxonomy semantics, and both must be active in the same registry/index-meta deployment. Candidate scope: `(ontology_id, prefix)`. |
| Tenant boundary | Tenant is runtime owner data, an axis value, or a registry owner metadata field; tenant-specific records can still share the same address mechanics. | A contractual or regulatory boundary requires tenant-isolated ontology namespaces where prefix text cannot leak, be renamed, or share decode/cache records. Candidate scope must prove tenant id is available to every registry, index-meta, and decode request. |
| Pack collisions | Imported packs can be normalized at install time by prefix renaming, pack namespace qualification, or allocation namespace metadata. | Third-party packs must coexist without mutation and expose the same prefix text with incompatible definitions inside one catalog or tenant boundary. Candidate scope: pack-qualified allocation namespace or `(catalog_id, prefix)` only after API/decode migration is accepted. |

Tenant scoping is the highest-risk option because it moves runtime ownership into address identity. It is allowed only after catalog or ontology scope is proven insufficient.

## Affected Surfaces

### `/prefixes/:prefix`

Current registry-service routes treat `prefix` as globally identifying one prefix profile and its versions. Scoped prefixes would make `GET /prefixes/:prefix`, `PATCH /prefixes/:prefix`, and `DELETE /prefixes/:prefix` ambiguous.

Any scoped-prefix implementation must choose one compatibility path before schema change:

- Keep `/prefixes/:prefix` global-only and add scoped routes such as `/catalogs/:catalogId/prefixes/:prefix`.
- Require a query/header scope and return a structured ambiguity error when omitted.
- Expose scoped lookup only through a new API version and leave v1 global.

### Index-Meta Key Shape

Current index-meta tables use `(prefix, version_id)` as the key shape for `prefix_registry`, `schema_version`, `entry`, `prefix_ref`, `version_lifecycle`, `address_state_cache`, and `address_range_cache`.

Scoped prefixes require either scope columns in every table that keys by prefix/version, or a canonical composite prefix string that remains globally unique after normalization. The latter keeps index-meta key shape stable but makes scope part of the prefix spelling. No index-meta migration may begin until this choice is made.

### Decode-Service And Cache Keys

Current decode-service identity is prefix/version based:

- `DecoderPool` keys decoders as `${prefix}:${version}`.
- L2 decode cache keys use `${prefix}:${version}:${input}` or `auto` placeholders.
- `/decode-map/:prefix/:version` has no scope segment.

Scoped prefixes must add the selected scope to decoder loading, direct lookup, auto-detection, L2 cache keys, decode-map routes, and cache invalidation. Without that, two scoped prefixes with the same text can return the wrong decoder or stale cached result.

### Migration Plan

A scoped-prefix migration plan is mandatory and must include:

1. Existing registry-service prefix inventory and collision report by catalog id, ontology id, tenant boundary, and pack source.
2. Chosen scope model and canonical key format.
3. Dual-read or v2 route behavior for existing `/prefixes/:prefix` consumers.
4. Index-meta table/key migration or composite-prefix backfill.
5. Decode-service decoder-pool key migration, L2 cache namespace invalidation, and decode-map compatibility.
6. Activation smoke proving old global prefixes still decode and new scoped collisions decode independently.

If this migration plan is not approved, the only allowed behavior is to reject conflicting allocations with structured collision errors.

## Decision Outcomes

Allowed outcomes for the future implementation ADR:

- **Retain global uniqueness** - keep current registry-service prefix table and index-meta key shape; use allocation namespace metadata and deterministic prefix naming for ontology packs.
- **Catalog-scoped prefix** - add or derive catalog scope only when catalog publication must preserve colliding prefix names.
- **Ontology-scoped prefix** - add or derive ontology scope only when independent ontology namespaces require the same prefix text with different semantics.
- **Tenant-scoped prefix** - allowed only when tenant isolation is a hard boundary and catalog/ontology scoping cannot satisfy it.

Pack collision alone is not enough to change prefix schema. The pack must also prove one of the catalog, ontology, or tenant evidence paths.
