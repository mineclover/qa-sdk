---
def:
  id: operational-ontology-registry-lifecycle
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, persistence]
  links:
    - target: operational-ontology-registry-allocation
      type: refines
    - target: operational-ontology-allocation-validation-contract
      type: depends_on
    - target: operational-ontology-registry-persistence-handoff
      type: depends_on
    - target: operational-ontology-index-meta-sync-handoff
      type: depends_on
sources:
  - packages/registry-service/src/db/schema.ts
  - packages/registry-service/src/stores/ontology-registry-store.ts
  - packages/registry-service/src/stores/ontology-registry-validation.ts
  - packages/registry-service/src/modules/ontology/ontology-registry.service.ts
  - packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
---

# Operational Ontology Registry Lifecycle

## 목적 ^purpose

Phase 2A부터 Phase 5까지 완료된 ontology registry lifecycle current state를 하나의 책임 문서로 고정한다. 목표는 persistence, store validation, service activation, index-meta sync, activation helper/smoke 경계를 lifecycle narrative로 섞지 않고 각 phase의 owner와 non-goal을 명확히 하는 것이다.

## 구성 ^overview

이 문서는 registry allocation System의 lifecycle detail이다. Record shape는 persistence handoff가, active allocation materialization은 index-meta sync handoff가, public CLI execution은 activation CLI 문서가 소유한다.

## Phase Current State ^defines

| phase | current state | owner boundary |
|-------|---------------|----------------|
| Phase 2A persistence schema | 완료. `ontology_namespace`, `ontology_axis`, `ontology_taxonomy`, `ontology_address_allocation`, `ontology_address_segment` table and migration surface are present. | registry-service DB schema and migration |
| Phase 2B store adapter | 완료. Complete allocation plan writes are validated before persistence and in-memory/SQL adapters share conflict semantics. | `OntologyRegistryStore` and shared validation |
| Phase 3 service lifecycle | 완료. Pack registration reserves address space, activation only allows `reserved -> active`, and sync requires active allocation. | `OntologyRegistryService` |
| Phase 4 index-meta sync | 완료. Active allocation bundles materialize product/sum prefix/schema records with idempotent, repaired, blocked, and post-sync report semantics. | `OntologyIndexMetaSyncAdapter` |
| Phase 5 activation helper/smoke | 완료. All allocations from registration are activated, synced, and summarized with product/sum smoke checks. | `OntologyPackActivationHelper` |

## Lifecycle Rules

- Namespace, axis, and taxonomy records remain `lifecycle: "draft"` during reservation.
- Reservation persists allocation records with `status: "reserved"` even when caller options provide another status.
- Activation mutates only allocation `status` from `reserved` to `active`.
- Deprecated or already active allocations cannot be reactivated through the current service path.
- Sync does not mutate allocation lifecycle. It consumes already-active allocation records and returns sync reports.
- Phase 5 smoke checks consume sync report post-checks instead of querying raw SQL tables.

## Conflict Surface

Store conflicts are `duplicate-key`, `drift`, `missing-taxonomy-axis`, `invalid-segment`, `segment-overlap`, and `partial-write-rejected`.

Service conflicts are `invalid-pack`, `invalid-allocation-plan`, `duplicate-allocation`, `invalid-transition`, `missing-allocation`, and `sync-precondition-failure`.

Phase 5 converts helper orchestration failures into activation result errors. It does not create a new persistence lifecycle state and does not add REST idempotency semantics.

## Non-Goals

This lifecycle does not define registry-service REST activation, remote store ownership, scoped prefix support, tenant/auth policy, pack authoring, or compensating rollback. Those require separate decision documents and implementation stories.
