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

## Phase 1: Operational schema allocation model — 완료

- [x] `OntologyNamespace` 타입 추가
- [x] `OntologyAxisRegistration` 타입 추가
- [x] `OntologyTaxonomyRegistration` 타입 추가
- [x] `OntologyAddressAllocation` 타입 추가
- [x] `OntologyAddressSegment` 타입 추가
- [x] `OntologyAddressAllocationPolicy` 타입 추가
- [x] `allocateOntologyAddressSpace(schema, policy)` 구현
- [x] `validateOntologyAddressAllocationPlan()` 구현
- [x] `operational-ontology/allocation` subpath export 추가
- [x] `operationalOntologyAllocationPlane` facade 추가
- [x] product address allocation 테스트 추가
- [x] sum address segment allocation 테스트 추가
- [x] duplicate prefix/version allocation 검증 추가
- [x] missing taxonomy axis 검증 추가
- [x] `operational-ontology-allocation-validation-contract`로 local allocation validation contract 문서화

## Phase 2: Registry-service persistence

- [ ] `registry-service/src/db/schema.ts`에 `ontology_namespace` 테이블 추가
  - [ ] `ontology_id` primary key
  - [ ] `namespace` unique
  - [ ] `owner`, `lifecycle`, `created_at`, `updated_at`
- [ ] `ontology_axis` 테이블 추가
  - [ ] primary key `(ontology_id, axis_id, version_id)`
  - [ ] `values_json`, `values_hash`, `capacity`, `lifecycle`
  - [ ] `ontology_id` foreign key 또는 store-level existence check 결정
- [ ] `ontology_taxonomy` 테이블 추가
  - [ ] primary key `(ontology_id, taxonomy_id, version_id)`
  - [ ] `applies_to_json`, `axis_ids_json`, `identity_axis_ids_json`, `space`, `lifecycle`
  - [ ] referenced axis 존재 검증을 store/service 중 어디에서 수행할지 결정
- [ ] `ontology_address_allocation` 테이블 추가
  - [ ] `allocation_id` primary key
  - [ ] unique `(prefix, version_id)`
  - [ ] unique `(ontology_id, taxonomy_id, version_id)`
  - [ ] `address_model`, `capacity`, `address_offset`, `address_size`, `status`
- [ ] `ontology_address_segment` 테이블 추가
  - [ ] primary key `(allocation_id, segment_id)`
  - [ ] `consumes_json`, `address_offset`, `address_size`
- [ ] SQL migration/Drizzle schema snapshot 갱신
- [ ] `OntologyRegistryStore` interface 추가
- [ ] `InMemoryOntologyRegistryStore` 추가
- [ ] `SqlOntologyRegistryStore` 추가
- [ ] table별 duplicate/collision 테스트 추가
- [ ] store-level list/get query 추가: namespace, taxonomy, allocation, active allocation

## Phase 3: Registry-service service layer

- [ ] `OntologyRegistryService` 추가
- [ ] `registerOntologyPack(pack, options)` 구현
  - [ ] `validateOperationalOntologyPack(pack)` 선행
  - [ ] invalid pack은 namespace/axis/taxonomy/allocation 저장 금지
  - [ ] packId를 기본 `ontologyId`로 사용
- [ ] `reserveAddressSpace(input)` 구현
  - [ ] `allocateOntologyAddressSpace()` 호출
  - [ ] allocation collision guard 적용
  - [ ] status는 기본 `reserved`
- [ ] `activateAllocation(allocationId)` 구현
  - [ ] reserved → active만 허용
  - [ ] deprecated allocation은 재활성화 금지
  - [ ] active prefix/version 중복 방지
- [ ] `syncToPrefixRegistry(allocationId)` 구현
  - [ ] active allocation만 sync 허용
  - [ ] sync 결과를 audit/report record로 반환
- [ ] service-level rollback/partial failure 정책 결정
- [ ] registry-service module/controller 노출 여부 결정
  - [ ] 내부 service only
  - [ ] REST endpoint
  - [ ] CLI-only adapter
- [ ] service unit test 추가: valid pack → reserved allocation
- [ ] service unit test 추가: invalid pack → no write
- [ ] service unit test 추가: duplicate prefix/version → error

## Phase 4: index-meta sync

- [ ] active allocation → `index-meta.prefix_registry` 등록
- [ ] active allocation → `index-meta.schema_version` 등록
- [ ] product allocation의 shape/refs 표현 방식 결정
  - [ ] leaf prefix로 단일 capacity만 등록
  - [ ] taxonomy axis를 child refs로 materialize
  - [ ] 기존 `PrefixRegistryRecord.refs`와의 매핑 규칙 정의
- [ ] sum allocation의 `ontology_address_segment` → index-meta segment/sum model 연결 방식 결정
  - [ ] 현재 index-meta에는 segment table이 없으므로 별도 follow-up 필요 여부 판단
- [ ] initial `entry` materialization 필요 조건 정의
  - [ ] axis values를 entry로 내릴지
  - [ ] taxonomy product 조합은 lazy decode로 둘지
- [ ] sync idempotency 테스트 추가
- [ ] `prefix_registry` already exists 처리 정책 결정
  - [ ] same allocation이면 no-op
  - [ ] other allocation이면 collision error
- [ ] `schema_version` capacity drift 감지 테스트 추가
- [ ] `address_state_cache` 계산은 후속 validation phase로 보류

## Phase 5: Pack activation flow

- [ ] end-to-end helper 정의: `activateOntologyPack(pack, options)`
- [ ] flow 단계 고정
  - [ ] pack validation
  - [ ] namespace upsert
  - [ ] axis/taxonomy registration
  - [ ] address allocation reservation
  - [ ] allocation activation
  - [ ] index-meta sync
  - [ ] smoke resolve/decode
- [ ] activation smoke 테스트: valid pack → allocation active → prefix registry resolve
- [ ] activation smoke 테스트: invalid pack → no allocation persisted
- [ ] activation smoke 테스트: duplicate prefix → blocked
- [ ] activation result payload 정의
  - [ ] namespace record
  - [ ] allocation records
  - [ ] index-meta sync summary
  - [ ] warnings/errors
- [ ] registry audit/report에 allocation drift 항목 추가
- [ ] operational-ontology pack registry와 registry-service activation flow 연결 문서화

## Phase 6: Catalog scoped prefix decision

- [ ] 단기 정책 명시: 기존 `registry-service.prefix` global uniqueness 유지
- [ ] `ontology_address_allocation`이 prefix/version collision guard를 맡는다는 ADR 작성
- [ ] catalog scoped prefix가 필요한 구체 시나리오 수집
  - [ ] 동일 prefix 이름을 서로 다른 ontology에서 독립 사용
  - [ ] 동일 catalog 내 pack별 prefix 충돌
  - [ ] 외부 tenant별 ontology namespace 분리
- [ ] API v2 후보 설계
  - [ ] `(catalog_id, prefix)`
  - [ ] `(ontology_id, prefix)`
  - [ ] global prefix + allocation namespace
- [ ] 기존 `/prefixes/:prefix` API 영향 분석
- [ ] index-meta key shape 영향 분석
- [ ] decode-service/cache key 영향 분석
- [ ] migration plan 작성 여부 결정
- [ ] 최종 결정 전까지 registry-service prefix table schema 변경 금지

## Cross-phase 검증

- [ ] `pnpm --filter operational-ontology test -- allocation`
- [ ] `pnpm --filter operational-ontology typecheck`
- [ ] `pnpm --filter operational-ontology build`
- [ ] `pnpm --filter registry-service test`
- [ ] `pnpm --filter index-meta test`
- [ ] `pnpm --filter @qa-sdk/cli typecheck`
- [ ] `node packages/cli/dist/index.js def validate`

## 다음 구현 기준

다음 단계는 registry-service persistence부터 시작한다. 단, prefix global uniqueness를 바로 깨지 않는다. 먼저 `ontology_address_allocation`에서 collision guard를 갖춘 뒤, catalog scoped prefix가 실제로 필요한지 별도 ADR로 판단한다.
