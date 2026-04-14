---
def:
  id: operational-ontology-registry-persistence-handoff
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, persistence, testing, contract, cross-scope]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-allocation-validation-contract
      type: depends_on
    - target: operational-ontology-registry-allocation-plan
      type: depends_on
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
    - target: registry-system
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/registry-service/src/db/schema.ts
  - packages/registry-service/drizzle/20260414043459_daily_vision/migration.sql
  - packages/registry-service/src/ontology-persistence.schema.sql.test.ts
  - packages/registry-service/src/stores/in-memory-axis-profile-store.ts
  - packages/registry-service/src/stores/sql-axis-profile-store.ts
---

# Operational Ontology Registry Persistence Handoff — registry-service row contract

## 목적 ^purpose

registry-service가 ontology namespace, axis, taxonomy, address allocation, allocation segment를 저장하기 시작할 때 소비해야 하는 최소 persistence record 계약을 정의한다. 목표는 DB schema 구현 전에 `operational-ontology`의 local allocation model과 registry-service store/service 불변조건 사이의 handoff를 고정하는 것이다.

## 구성 ^overview

이 문서는 Phase 2 persistence 구현의 입력 계약이다. Phase 2A schema/migration은 이 계약을 구현했으며, Phase 2B store adapter와 Phase 3 service layer는 같은 record/collision contract를 소비한다.

- **Persistence records** — registry-service가 저장해야 하는 개념적 row shape.
- **Local field mapping** — 각 row가 `OntologyAddressAllocationPlan`의 어떤 필드에서 오는지.
- **Collision rules** — store unique constraint 또는 service validation으로 막아야 하는 중복과 drift.
- **Future tests** — registry-service persistence가 시작될 때 추가해야 하는 테스트 목록.

Phase 2A는 실제 `registry-service/src/db/schema.ts` 변경, SQL migration, Drizzle snapshot, migration-backed SQL schema test를 추가했다. 이 문서는 아직 store adapter, service/controller 구현, REST/CLI exposure 결정을 만들지 않는다. 그런 구현은 Phase 2B/3 story에서 선택한다.

## Persistence Records ^defines

### OntologyNamespacePersistenceRecord

| persistence field | local model field |
|-------------------|-------------------|
| `ontologyId` | `OntologyNamespace.ontologyId` |
| `namespace` | `OntologyNamespace.namespace` |
| `owner` | `OntologyNamespace.owner` |
| `lifecycle` | `OntologyNamespace.lifecycle` |
| `createdAt` | `OntologyNamespace.createdAt` |
| `updatedAt` | `OntologyNamespace.updatedAt` |

The namespace record owns registry lifecycle identity. `namespace` is normalized by `allocateOntologyAddressSpace()` before persistence and must not be re-normalized differently in registry-service.

### OntologyAxisPersistenceRecord

| persistence field | local model field |
|-------------------|-------------------|
| `ontologyId` | `OntologyAxisRegistration.ontologyId` |
| `axisId` | `OntologyAxisRegistration.axisId` |
| `versionId` | `OntologyAxisRegistration.versionId` |
| `valuesJson` | JSON serialization of `OntologyAxisRegistration.values` |
| `valuesHash` | `OntologyAxisRegistration.valuesHash` |
| `capacity` | `OntologyAxisRegistration.capacity` |
| `lifecycle` | `OntologyAxisRegistration.lifecycle` |

`valuesJson` preserves value order because the local `valuesHash` is computed from the ordered value list. Registry-service must not sort values before storing or comparing hashes.

### OntologyTaxonomyPersistenceRecord

| persistence field | local model field |
|-------------------|-------------------|
| `ontologyId` | `OntologyTaxonomyRegistration.ontologyId` |
| `taxonomyId` | `OntologyTaxonomyRegistration.taxonomyId` |
| `versionId` | `OntologyTaxonomyRegistration.versionId` |
| `appliesToJson` | JSON serialization of `OntologyTaxonomyRegistration.appliesTo` |
| `axisIdsJson` | JSON serialization of `OntologyTaxonomyRegistration.axisIds` |
| `identityAxisIdsJson` | JSON serialization of `OntologyTaxonomyRegistration.identityAxisIds` |
| `space` | `OntologyTaxonomyRegistration.space` |
| `lifecycle` | `OntologyTaxonomyRegistration.lifecycle` |

The referenced axes must already exist for the same `ontologyId` and `versionId`, or the service must reject the write before any partial taxonomy/allocation rows are persisted.

### OntologyAddressAllocationPersistenceRecord

| persistence field | local model field |
|-------------------|-------------------|
| `allocationId` | `OntologyAddressAllocation.allocationId` |
| `ontologyId` | `OntologyAddressAllocation.ontologyId` |
| `taxonomyId` | `OntologyAddressAllocation.taxonomyId` |
| `prefix` | `OntologyAddressAllocation.prefix` |
| `versionId` | `OntologyAddressAllocation.versionId` |
| `addressModel` | `OntologyAddressAllocation.addressModel` |
| `capacity` | `OntologyAddressAllocation.capacity` |
| `addressOffset` | `OntologyAddressAllocation.addressOffset` |
| `addressSize` | `OntologyAddressAllocation.addressSize` |
| `status` | `OntologyAddressAllocation.status` |

The allocation row is the registry-service owner of reserved/active/deprecated lifecycle state. Active allocation sync to index-meta is outside this story.

### OntologyAddressSegmentPersistenceRecord

| persistence field | local model field |
|-------------------|-------------------|
| `allocationId` | `OntologyAddressSegment.allocationId` |
| `segmentId` | `OntologyAddressSegment.segmentId` |
| `consumesJson` | JSON serialization of `OntologyAddressSegment.consumes` |
| `addressOffset` | `OntologyAddressSegment.addressOffset` |
| `addressSize` | `OntologyAddressSegment.addressSize` |

Product allocation normally persists one segment that consumes all taxonomy axes. Sum allocation persists one segment per consumed axis in the local taxonomy order.

## Phase 2A Implementation Refinements ^implementation-refinements

The registry-service table implementation keeps these handoff refinements as part of the contract for later adapters:

- DB table and column names use registry-service snake_case, while Drizzle exports keep camelCase properties.
- JSON payload fields stay plain text columns named `*_json`; store adapters must serialize and parse them explicitly.
- `owner` and `space` remain nullable because the local allocation model treats them as optional.
- Namespace, axis, and taxonomy lifecycle values are checked as `draft | active | deprecated`; allocation status is separately checked as `reserved | active | deprecated`.
- `address_model` is checked as `product | sum`, matching `operational-ontology` allocation output.
- Phase 2A does not add SQLite foreign keys. Taxonomy axis existence, segment range/overlap, lifecycle transition, and no-partial-write validation remain store/service responsibilities.

## Store And Service Collision Rules

Registry-service persistence must enforce these rules either as table constraints, store adapter checks, or service-level transaction validation:

- `ontologyId` identifies one namespace record. Re-inserting the same `ontologyId` with different `namespace`, `owner`, or lifecycle fields is a conflict unless an explicit update path is used.
- `namespace` is globally unique. The same namespace cannot point to two different ontology ids.
- `(ontologyId, axisId, versionId)` is unique. Same-key writes with a different `valuesHash` or `capacity` are drift, not an overwrite.
- `(ontologyId, taxonomyId, versionId)` is unique. Same-key writes with different axis, identity axis, applies-to, or space data are drift.
- Every taxonomy axis reference must resolve to an axis registration with the same `ontologyId` and `versionId`.
- `allocationId` is unique.
- `(prefix, versionId)` is globally unique while Phase 6 scoped-prefix policy is unresolved.
- `(ontologyId, taxonomyId, versionId)` has at most one allocation.
- `(allocationId, segmentId)` is unique.
- Segment rows must reference an existing allocation, consume at least one axis, have positive `addressSize`, stay inside the allocation range, and not overlap another segment in the same allocation.

Before persistence writes, the service should run `validateOperationalOntologyPack()` when a pack is supplied and `validateOntologyAddressAllocationPlan()` on the projected plan. Invalid local plans must be no-write failures.

## Registry-Service Test Surface

Phase 2A added `packages/registry-service/src/ontology-persistence.schema.sql.test.ts`. It initializes registry-service migrations with a SQL driver, verifies that the five ontology tables exist, and asserts duplicate-key rejection for namespace, axis, taxonomy, allocation, and segment identities.

Phase 2B/3 still need these tests before or with their implementation:

- `src/stores/ontology-registry-store.test.ts` — shared store contract covering namespace uniqueness, axis/taxonomy duplicate keys, allocation duplicate keys, and segment duplicate/range checks for both in-memory and SQL adapters.
- `src/modules/ontology/ontology-registry.service.test.ts` — valid plan persists namespace, axis, taxonomy, allocation, and segment rows in one transaction.
- `src/modules/ontology/ontology-registry.service.test.ts` — invalid pack or invalid allocation plan leaves no partial rows.
- `src/modules/ontology/ontology-registry.service.test.ts` — duplicate `(prefix, versionId)` and duplicate `(ontologyId, taxonomyId, versionId)` fail with structured conflict errors.
