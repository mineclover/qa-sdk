---
def:
  id: operational-ontology-allocation-validation-contract
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-validation-boundary
      type: depends_on
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
---

# Operational Ontology Allocation Validation Contract — local allocation 불변조건

## 목적 ^purpose

`allocateOntologyAddressSpace()`와 `validateOntologyAddressAllocationPlan()`이 현재 보장하는 local allocation 불변조건을 고정한다. 목표는 registry-service persistence 구현이 추가될 때 product/sum 주소 배정, prefix/version collision, taxonomy axis 참조 검증을 다시 해석하지 않고 현재 operational-ontology package의 순수 함수 계약을 보존하게 하는 것이다.

## 구성 ^overview

이 계약은 세 계층을 분리한다.

- **Projection contract** — `OperationalOntologySchema`와 allocation policy를 namespace, axis registration, taxonomy registration, address allocation, segment record로 투영하는 규칙.
- **Validation contract** — 단일 allocation plan 안에서 error/warning으로 판정하는 불변조건.
- **Persistence deferral** — 여러 pack/ontology 등록, DB uniqueness, lifecycle transition, index-meta sync가 필요한 불변조건.

## 실행 가능한 SSOT ^defines

현재 executable source of truth는 기존 allocation 테스트다.

- 구현: `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
- 공개 facade: `packages/operational-ontology/src/allocation.ts`
- 테스트: `packages/operational-ontology/src/allocation.test.ts`

이 문서는 테스트를 대체하지 않는다. product allocation, sum segment allocation, duplicate prefix/version allocation, missing taxonomy axis의 실제 판정은 `pnpm --filter operational-ontology test -- allocation`에서 확인한다.

## Projection Contract

`allocateOntologyAddressSpace(schema, policy)`는 registry-service DB 없이 allocation plan을 만든다.

- 기본값은 `versionId: "v1"`, `lifecycle: "draft"`, `status: "reserved"`, `addressModel: "product"`, `now: new Date(0).toISOString()`이다.
- namespace는 `policy.namespace ?? policy.ontologyId`를 lowercase snake identifier로 정규화한다.
- axis registration은 schema axis마다 하나씩 생성한다. capacity는 `policy.capacityByAxisId[axis.id]`, `axis.capacity`, `nextPowerOf2(axis.values.length * 2)` 순서로 선택한다.
- axis `valuesHash`는 axis values를 NUL delimiter로 join한 문자열의 stable `fnv1a32` hash다.
- taxonomy registration은 schema taxonomy마다 하나씩 생성한다. `identityAxisIds`가 없으면 `axisIds`를 그대로 사용한다.
- allocation id는 `${ontologyId}:${taxonomyId}:${versionId}` 형식이다.
- prefix는 `policy.prefixByTaxonomyId[taxonomyId]`가 있으면 그 값을 쓰고, 없으면 `${namespace}_${normalizedTaxonomyId}`를 쓴다.
- allocation offset은 `policy.addressOffsetStart ?? 0`에서 시작하고 taxonomy 순서대로 누적한다.
- allocation `capacity`와 `addressSize`는 같은 값으로 기록한다. taxonomy override가 있으면 `policy.capacityByTaxonomyId[taxonomyId]`가 계산값보다 우선한다.

## Product Allocation

`addressModel: "product"`는 taxonomy의 모든 axis capacity를 곱해 address size를 계산한다.

- 한 taxonomy는 allocation 하나를 만든다.
- product segment는 allocation마다 하나만 만든다.
- product segment `consumes`는 taxonomy `axisIds` 전체다.
- product segment offset은 allocation offset과 같고, segment size는 allocation size와 같다.

현재 테스트는 `resource_kind(8) * enforcement_kind(8) = 64`와 `decision_kind(4) = 4`를 product allocation으로 검증한다.

## Sum Segment Allocation

`addressModel: "sum"`은 taxonomy의 axis capacity를 더해 address size를 계산한다.

- 한 taxonomy는 allocation 하나를 만든다.
- sum segment는 taxonomy axis마다 하나씩 만든다.
- 각 sum segment `consumes`는 단일 axis id만 가진다.
- segment offset은 allocation offset에서 시작해 axis 순서대로 segment size만큼 증가한다.
- allocation offset은 taxonomy 전체 sum size만큼 증가한다.

현재 테스트는 `addressOffsetStart: 100`에서 `resource_kind(8)` segment가 100, `enforcement_kind(8)` segment가 108에 배치되는 것을 검증한다.

## Validation Contract

`validateOntologyAddressAllocationPlan()`은 단일 allocation plan의 내부 모순을 판정한다. `schema`가 제공되면 먼저 `validateOperationalOntologySchema()` 결과를 `schema.*` path로 포함한다.

local validation error:

- 빈 `namespace.ontologyId` 또는 빈 `namespace.namespace`.
- 중복 axis registration key: `(ontologyId, axisId, versionId)`.
- 중복 taxonomy registration key: `(ontologyId, taxonomyId, versionId)`.
- 중복 prefix/version allocation key: `(prefix, versionId)`.
- 중복 taxonomy allocation key: `(ontologyId, taxonomyId, versionId)`.
- taxonomy `axisIds`가 같은 `(ontologyId, axisId, versionId)` axis registration에 존재하지 않음.
- taxonomy `identityAxisIds`가 taxonomy `axisIds`에 포함되지 않음.
- allocation `capacity` 또는 `addressSize`가 0 이하.
- allocation `addressOffset`이 음수.
- segment가 존재하지 않는 allocation을 참조함.
- segment `addressSize`가 0 이하.
- segment `consumes`가 비어 있음.

local validation warning:

- allocation `capacity`와 `addressSize`가 다름.

`valid`는 error가 하나도 없을 때만 `true`다. warning만 있는 plan은 valid로 남는다.

## Required Scenario Coverage

| 시나리오 | operational-ontology local invariant | registry-service persistence deferral |
|----------|--------------------------------------|----------------------------------------|
| duplicate prefix/version allocation | 단일 plan 안의 `(prefix, versionId)` 중복은 `ontology-prefix-version-duplicate` error다. | DB 전체의 `(prefix, version_id)` uniqueness와 기존 active allocation collision은 `ontology_address_allocation` table/store가 enforce한다. |
| missing taxonomy axis | schema validation의 `taxonomy-axis-missing`과 allocation validation의 `ontology-taxonomy-axis-missing`으로 local plan이 invalid가 된다. | 외부 DTO나 partial write가 들어올 경우 `(ontology_id, axis_id, version_id)` 존재 검증을 store/service boundary에서 다시 막는다. |
| product allocation | axis capacity product, single product segment, taxonomy-order offset 누적은 operational-ontology가 계산한다. | persisted allocation row는 계산 결과를 보존하고, activation/sync가 prefix_registry와 schema_version drift를 감지한다. |
| sum segment allocation | axis capacity sum, per-axis segment, segment-order offset 누적은 operational-ontology가 계산한다. | segment table primary key와 active allocation sync 정책은 registry-service/index-meta lifecycle에서 결정한다. |

## Ownership Boundary

`operational-ontology` owns:

- schema-driven allocation plan projection.
- policy defaulting and deterministic namespace/prefix/id/capacity derivation.
- local duplicate detection inside one allocation plan.
- local missing taxonomy axis detection.
- product and sum address model calculations.
- segment shape validation.

registry-service persistence owns later:

- namespace uniqueness and owner/lifecycle persistence.
- table-level uniqueness for `(ontology_id, axis_id, version_id)`, `(ontology_id, taxonomy_id, version_id)`, `(prefix, version_id)`, and `(allocation_id, segment_id)`.
- cross-pack/cross-ontology allocation collision checks.
- reserved/active/deprecated state transitions.
- invalid pack no-write behavior.
- rollback, idempotency, and audit/report records.

index-meta sync owns later:

- active allocation projection into `prefix_registry` and `schema_version`.
- capacity drift handling after activation.
- decode/materialization behavior for entries and address state cache.
