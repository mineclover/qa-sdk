---
def:
  id: operational-ontology-registry-allocation-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, observability, contract]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-registry-allocation
      type: traces_to
    - target: operational-ontology-taxonomy-schema
      type: depends_on
    - target: operational-ontology-pack-interface
      type: depends_on
    - target: registry-system
      type: depends_on
    - target: index-meta-system
      type: depends_on
---

# Operational Ontology Registry Allocation — 방향 계획

## 목적 ^purpose

operational ontology schema를 registry-service와 index-meta가 소비할 수 있는 영속 등록/주소 배정 흐름으로 승격하는 로드맵을 정의한다. 목표는 axis/taxonomy 의미는 `operational-ontology`가 소유하고, namespace/allocation/lifecycle은 `registry-service`가 소유하며, 실제 prefix/version/capacity/address decode는 `index-meta`가 소유하도록 SSOT 경계를 나누는 것이다.

## 현재 목표

현재 완료된 1단계는 DB에 의존하지 않는 allocation model이다. `OperationalOntologySchema`를 `OntologyNamespace`, `OntologyAxisRegistration`, `OntologyTaxonomyRegistration`, `OntologyAddressAllocation`, `OntologyAddressSegment`로 투영하고, registry-service DB 테이블 없이도 prefix/version/address allocation 계획을 검증할 수 있다.

이 완료 상태와 ralph 안정화로 생성된 validation/handoff 계약은 `operational-ontology-registry-allocation` spec에 반영됐다. 이 plan은 앞으로 남은 persistence, service layer, index-meta sync, activation flow 방향만 유지한다.

구현 위치:

- `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
- `packages/operational-ontology/src/allocation.ts`
- `packages/operational-ontology/src/allocation.test.ts`

## 장기 목표

장기 목표는 `OperationalOntologyPack`을 registry-service에 등록하면 pack schema validation, namespace registration, address reservation, allocation activation, index-meta sync가 하나의 lifecycle로 닫히는 것이다. 이때 registry-service는 ontology-aware allocator/registry 역할을 맡고, index-meta는 active allocation을 prefix registry와 schema version으로 받아 실제 address decode/capacity SSOT를 유지한다.

Phase 5 internal lifecycle이 닫힌 뒤의 다음 선택지는 public/local execution surface다. CLI activation proof는 `tasks/prd-ontology-registry-activation-cli.md` / `.json`이 추적하며, 이는 lifecycle phase를 다시 여는 작업이 아니라 완료된 activation helper를 사람이 실행 가능한 command로 노출하는 작업이다.

## 단계

### Phase 1: Operational schema allocation model

상태: 완료.

- `OntologyNamespace`
- `OntologyAxisRegistration`
- `OntologyTaxonomyRegistration`
- `OntologyAddressAllocation`
- `OntologyAddressSegment`
- `allocateOntologyAddressSpace(schema, policy)`
- `validateOntologyAddressAllocationPlan(plan)`

이 단계는 DB 독립 순수 함수로 유지한다. registry-service는 이 타입을 그대로 persistence DTO로 받아도 되고, 별도 DB row mapper로 변환해도 된다.
세부 persistence handoff는 `operational-ontology-registry-persistence-handoff`가 소유한다.

### Phase 2: Registry-service persistence

registry-service persistence 구현은 `operational-ontology-registry-persistence-handoff`의 record mapping과 collision rule을 입력으로 삼아 시작한다. 실제 DB schema와 migration은 이 로드맵이 아니라 후속 implementation story에서 추가한다.

예상 record boundary:

- `ontology_namespace`
- `ontology_axis`
- `ontology_taxonomy`
- `ontology_address_allocation`
- `ontology_address_segment`

최소 불변조건:

- `ontology_namespace.namespace`는 유일해야 한다.
- `(ontology_id, axis_id, version_id)`는 유일해야 한다.
- `(ontology_id, taxonomy_id, version_id)`는 유일해야 한다.
- `(prefix, version_id)` allocation은 유일해야 한다.
- `(ontology_id, taxonomy_id, version_id)` allocation은 유일해야 한다.

### Phase 3: Registry-service service layer

`OntologyRegistryService`를 추가한다.

- `registerOntologyPack(pack)`
- `reserveAddressSpace(input)`
- `activateAllocation(allocationId)`
- `syncToPrefixRegistry(allocationId)`

등록은 항상 schema validation을 먼저 실행한다. invalid pack은 allocation 예약으로 넘어가지 않는다.

### Phase 4: index-meta sync

active allocation만 index-meta로 내려보낸다.

- `ontology_address_allocation(prefix, version_id, capacity)` → `prefix_registry`
- `ontology_address_segment` 또는 allocation capacity → `schema_version`
- 필요할 때만 initial `entry` materialization
- `address_state_cache`는 activation 후 validation/analysis 단계에서 계산한다.

sync input, product/sum materialization, idempotency/collision policy, and minimum smoke checks are defined by `operational-ontology-index-meta-sync-handoff`. This roadmap does not implement those records directly.

### Phase 5: Pack activation flow

`OperationalOntologyPack` 등록을 registry activation workflow로 연결한다.

1. pack validation
2. namespace upsert
3. axis/taxonomy registration
4. address allocation reservation
5. allocation activation
6. index-meta sync
7. smoke decode/resolve

### Phase 6: Catalog scoped prefix decision

단기적으로는 기존 `registry-service.prefix`의 global prefix uniqueness를 유지하고, `ontology_address_allocation`이 collision guard를 맡는다. 장기적으로 여러 catalog/ontology가 같은 prefix 이름을 독립적으로 가져야 하면 registry-service API v2에서 `(catalog_id, prefix)` 또는 `(ontology_id, prefix)` scoped prefix로 확장한다.

Phase 6의 decision criteria와 schema freeze rule은 `operational-ontology-scoped-prefix-decision`이 소유한다. 해당 문서가 scoped-prefix implementation ADR로 닫히기 전까지 registry-service `prefix` table primary key, `/prefixes/:prefix`, index-meta `(prefix, version_id)` key shape, decode-service prefix/version cache key는 변경하지 않는다.

## 위험과 대응

| 위험 | 대응 |
|------|------|
| allocation과 prefix_registry가 drift | active allocation만 sync하고, sync 결과를 registry-service audit에 남긴다. |
| ontology namespace와 catalog id 혼동 | namespace는 ontology ownership, catalog id는 배포/소비 채널로 분리한다. |
| address offset이 기존 prefix와 충돌 | allocation table의 `(prefix, version_id)`와 address range validation을 먼저 통과시킨다. |
| operational observation store와 registry state 혼동 | observation store에는 runtime fact만 두고, registry-service에는 allocation/lifecycle state만 둔다. |
| CLI가 lifecycle logic을 재구현 | CLI는 `OntologyPackActivationHelper`를 호출하고 JSON 결과를 투영만 한다. |
