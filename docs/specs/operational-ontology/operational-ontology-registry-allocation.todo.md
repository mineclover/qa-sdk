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

## 실행 dependency map

- Phase 1은 완료된 local allocation contract이며 모든 후속 phase의 입력이다.
- Phase 2A/2B persistence work는 Phase 1만 필요하다. Phase 2 persistence tasks는 Phase 4 index-meta sync 구현이나 index-meta schema 변경에 의존하지 않는다.
- Phase 2B store adapter는 Phase 2A schema contract를 소비한다. SQL adapter는 migration/schema snapshot이 필요하지만 in-memory adapter는 schema 결정만으로 병렬 작성 가능하다.
- Phase 3 service layer는 Phase 2B store contract와 Phase 1 allocation validator를 소비한다. `syncToPrefixRegistry()`는 Phase 4가 닫히기 전까지 active allocation 검증과 audit/report shell까지만 구현할 수 있다.
- Phase 4 index-meta sync는 active allocation contract를 소비한다. Phase 4의 표현 방식 결정은 Phase 2A/2B persistence schema를 역으로 변경하지 않는다.
- Phase 5 activation smoke는 Phase 3 service layer를 먼저 필요로 한다. full prefix registry resolve/decode smoke는 Phase 4 완료 후 실행한다.
- Phase 6 prefix policy는 schema 변경 전 결정 gate다. prefix table schema 변경은 Phase 6 결정 전까지 금지하지만 Phase 2A/2B의 `ontology_address_allocation` collision guard는 진행 가능하다.

## Phase 1: Operational schema allocation model — 완료

Goal: DB 독립 allocation model과 validation contract를 고정한다.

Non-goals: registry-service persistence, index-meta sync, scoped prefix policy 변경.

Prerequisites: 없음.

Validation commands:

- `pnpm --filter operational-ontology test`
- `pnpm --filter operational-ontology typecheck`
- `pnpm --filter operational-ontology build`
- `node packages/cli/dist/index.js def validate`

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

## Phase 2A: Persistence schema

Goal: registry-service가 ontology namespace, axis, taxonomy, allocation, segment lifecycle state를 저장할 최소 DB schema와 migration snapshot을 갖는다.

Non-goals: store adapter 구현, service layer 구현, index-meta sync, scoped prefix schema 변경.

Prerequisites:

- Phase 1 완료.
- `operational-ontology-allocation-validation-contract`의 local allocation DTO와 deferred persistence invariants 확인.

Validation commands:

- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `node packages/cli/dist/index.js def validate`

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

## Phase 2B: Store adapter

Goal: persistence schema 위에 ontology registry read/write adapter를 추가하고 duplicate/collision invariant를 store boundary에서 검증한다.

Non-goals: service orchestration, pack activation workflow, index-meta sync, REST/CLI exposure decision.

Prerequisites:

- Phase 1 완료.
- Phase 2A schema contract 결정.
- Phase 4 index-meta sync 미구현 상태에서도 list/get, collision, active allocation query가 동작해야 한다.

Validation commands:

- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `node packages/cli/dist/index.js def validate`

- [ ] `OntologyRegistryStore` interface 추가
- [ ] `InMemoryOntologyRegistryStore` 추가
- [ ] `SqlOntologyRegistryStore` 추가
- [ ] table별 duplicate/collision 테스트 추가
- [ ] store-level list/get query 추가: namespace, taxonomy, allocation, active allocation

## Phase 3: Registry-service service layer

Goal: pack validation, reservation, activation, and sync handoff를 service API로 묶어 invalid pack no-write와 active allocation lifecycle을 보장한다.

Non-goals: index-meta record materialization, activation smoke coverage, external API shape 확정.

Prerequisites:

- Phase 1 완료.
- Phase 2B store adapter 완료.
- Phase 4 전에는 `syncToPrefixRegistry()`가 active allocation precondition과 audit/report 반환 형태까지만 닫힐 수 있음을 명시한다.

Validation commands:

- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `pnpm --filter operational-ontology typecheck`
- `node packages/cli/dist/index.js def validate`

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

Goal: active allocation을 index-meta prefix registry/schema version contract로 내리고 idempotency, collision, capacity drift 정책을 고정한다.

Non-goals: Phase 2 persistence schema 재설계, address_state_cache 계산, full activation smoke helper 구현.

Prerequisites:

- Phase 1 완료.
- Phase 3의 active allocation contract 또는 동등한 handoff fixture.
- index-meta sync 표현 방식 결정은 Phase 2A/2B persistence tasks의 선행조건이 아니다.

Validation commands:

- `pnpm --filter index-meta test`
- `pnpm --filter index-meta typecheck`
- `pnpm --filter index-meta build`
- `pnpm --filter registry-service test`
- `node packages/cli/dist/index.js def validate`

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

## Phase 5: Activation smoke

Goal: pack activation helper와 smoke checks로 valid/invalid/duplicate lifecycle 결과를 끝까지 검증한다.

Non-goals: 새 persistence table 추가, scoped prefix API 변경, address_state_cache validation phase 구현.

Prerequisites:

- Phase 3 service layer 완료.
- full prefix registry resolve/decode smoke는 Phase 4 index-meta sync 완료.
- invalid pack no-write와 duplicate prefix blocked smoke는 Phase 4 없이도 Phase 3 store/service boundary에서 먼저 실행 가능하다.

Validation commands:

- `pnpm --filter operational-ontology test`
- `pnpm --filter registry-service test`
- `pnpm --filter index-meta test`
- `pnpm --filter operational-ontology typecheck`
- `node packages/cli/dist/index.js def validate`

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

## Phase 6: Prefix policy

Goal: global prefix uniqueness 유지/변경 기준을 결정하고, scoped prefix가 필요한 경우의 API/index-meta/decode migration surface를 분리한다.

Non-goals: 즉시 prefix table schema 변경, `/prefixes/:prefix` API v2 구현, index-meta key shape migration 실행.

Prerequisites:

- Phase 1 완료.
- Phase 2A/2B는 global prefix uniqueness와 `ontology_address_allocation` collision guard를 유지한 상태로 진행 가능하다.
- scoped prefix가 필요하다는 evidence가 생기면 별도 ADR 또는 decision doc으로 Phase 6을 먼저 닫는다.

Validation commands:

- `pnpm --filter operational-ontology test`
- `pnpm --filter operational-ontology typecheck`
- `pnpm --filter operational-ontology build`
- `node packages/cli/dist/index.js def validate`

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
