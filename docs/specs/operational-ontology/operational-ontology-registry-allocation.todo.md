---
def:
  id: operational-ontology-registry-allocation-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: operational-ontology-registry-allocation-plan
      type: refines
    - target: operational-ontology-ssot-navigation-guide
      type: depends_on
---

# Operational Ontology Registry Allocation — 구현 TODO

## 목적 ^purpose

operational ontology schema를 registry-service의 ontology-aware registry/allocator로 승격하기 위한 구현 항목을 추적한다. 목표는 완료된 DB 독립 allocation model 다음에 registry-service persistence, service layer, index-meta sync, pack activation flow를 순서대로 닫는 것이다.

## 구현 항목

- [x] DB 독립 allocation 타입 추가
- [x] `allocateOntologyAddressSpace(schema, policy)` 구현
- [x] `validateOntologyAddressAllocationPlan()` 구현
- [x] `operational-ontology/allocation` subpath export 추가
- [x] product/sum address allocation 테스트 추가
- [x] duplicate prefix/version allocation 검증 추가
- [ ] registry-service DB 테이블 추가: `ontology_namespace`
- [ ] registry-service DB 테이블 추가: `ontology_axis`
- [ ] registry-service DB 테이블 추가: `ontology_taxonomy`
- [ ] registry-service DB 테이블 추가: `ontology_address_allocation`
- [ ] registry-service DB 테이블 추가: `ontology_address_segment`
- [ ] registry-service in-memory/sql store interface 추가
- [ ] `OntologyRegistryService.registerOntologyPack(pack)` 구현
- [ ] `OntologyRegistryService.reserveAddressSpace(input)` 구현
- [ ] `OntologyRegistryService.activateAllocation(allocationId)` 구현
- [ ] `OntologyRegistryService.syncToPrefixRegistry(allocationId)` 구현
- [ ] activation 시 `index-meta.prefix_registry` sync 테스트 추가
- [ ] activation 시 `index-meta.schema_version` sync 테스트 추가
- [ ] allocation collision guard 테스트 추가
- [ ] registry-service API surface 결정: internal service only vs REST endpoint
- [ ] catalog scoped prefix 전환 필요성 ADR 작성
- [ ] pack activation smoke: valid pack → allocation active → prefix registry resolve
- [ ] registry audit/report에 allocation drift 항목 추가

## 다음 구현 기준

다음 단계는 registry-service persistence부터 시작한다. 단, prefix global uniqueness를 바로 깨지 않는다. 먼저 `ontology_address_allocation`에서 collision guard를 갖춘 뒤, catalog scoped prefix가 실제로 필요한지 별도 ADR로 판단한다.
