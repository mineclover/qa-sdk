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
    - target: operational-ontology-registry-allocation
      type: traces_to
    - target: operational-ontology-registry-allocation-plan
      type: refines
    - target: operational-ontology-ssot-navigation-guide
      type: depends_on
---

# Operational Ontology Registry Allocation — 구현 TODO

## 목적 ^purpose

operational ontology schema를 registry-service의 ontology-aware registry/allocator로 승격하기 위한 구현 항목을 추적한다. 목표는 완료된 DB 독립 allocation model 다음에 registry-service persistence, service layer, index-meta sync, pack activation flow를 순서대로 닫는 것이다.

완료된 local allocation model, validation issue target, validation boundary, matrix, graph requirement, Phase 2A persistence schema, Phase 2B store adapter, Phase 3 service layer, Phase 4 index-meta sync, Phase 5 activation smoke, persistence/index-meta handoff, scoped prefix decision은 `operational-ontology-registry-allocation` spec에 반영됐다. 이 TODO는 scoped prefix가 별도 decision PRD로 재개되기 전까지 남은 정책-only 항목을 명시한다.

## 실행 dependency map

- Phase 1은 완료된 local allocation contract이며 모든 후속 phase의 입력이다.
- Phase 2A/2B persistence work는 Phase 1만 필요하다. Phase 2 persistence tasks는 Phase 4 index-meta sync 구현이나 index-meta schema 변경에 의존하지 않는다.
- Phase 2B store adapter는 Phase 2A schema contract를 소비한다. SQL adapter는 migration/schema snapshot이 필요하지만 in-memory adapter는 schema 결정만으로 병렬 작성 가능하다.
- Phase 3 service layer는 Phase 2B store contract와 Phase 1 allocation validator를 소비해 완료됐다. Phase 4 이후 `syncToPrefixRegistry()`는 active allocation bundle을 수집한 뒤 ontology index-meta sync adapter에 위임한다.
- Phase 3은 pack validation, address reservation, allocation activation workflow를 service boundary로 조율한다. Phase 2B store transaction은 complete allocation plan write를 원자화하고, service layer는 local validation no-write, reserved-only activation, active prefix/version collision guard를 담당한다.
- Phase 4 index-meta sync는 active allocation contract를 소비해 완료됐다. Phase 4의 표현 방식 결정은 Phase 2A/2B persistence schema를 역으로 변경하지 않는다.
- Phase 5 activation smoke는 완료됐다. Helper는 Phase 3 service layer와 Phase 4 sync report/post-sync check surface만 소비하고, prefix registry store나 SQL에 직접 접근하지 않는다.
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

## Phase 2A: Persistence schema — 완료

Goal: registry-service가 ontology namespace, axis, taxonomy, allocation, segment lifecycle state를 저장할 최소 DB schema와 migration snapshot을 갖는다.

Non-goals: store adapter 구현, service layer 구현, index-meta sync, scoped prefix schema 변경.

Prerequisites:

- Phase 1 완료.
- `operational-ontology-allocation-validation-contract`의 local allocation DTO와 deferred persistence invariants 확인.
- `operational-ontology-registry-persistence-handoff`의 record mapping과 collision rule 확인.

Validation commands:

- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `node packages/cli/dist/index.js def validate`

US-001 implementation notes:

- Inspected registry-service schema surfaces: `src/db/schema.ts` is the Drizzle table SSOT, `drizzle.config.ts` emits SQLite migrations to `./drizzle`, `src/bootstrap/stores.ts` applies `../../drizzle` migrations from the built/source package path when creating a SQL driver, and `tsup.config.ts` copies `drizzle` into `dist/` after build.
- Existing tables use snake_case DB table/column names with camelCase TypeScript exports/properties. Primary keys are either single text `.primaryKey()` columns or natural composite `primaryKey({ columns: [...] })`; generated SQL names composite constraints as `<table>_pk`. Non-unique lookup indexes use `idx_<table>_<purpose>`.
- Existing registry JSON payload columns are plain `text` columns named `*_json`; store code serializes with `JSON.stringify()` and parses with helpers such as `parseJsonColumn()`. Do not switch ontology persistence to Drizzle JSON mode unless a separate story changes the registry-service convention.
- Timestamps are text ISO strings owned by application/store code. Mutable records commonly have `updated_at`; lifecycle/versioned records use `created_at` plus `updated_at`, and lifecycle transition timestamps are nullable text columns such as `published_at`, `deprecated_at`, and `archived_at`.
- Lifecycle/status fields are plain text enums (`status`, `state`, future `lifecycle`) with Drizzle `check(...)` declarations named `chk_<table>_<field>`. New ontology tables should generate enum checks in the table-creation migration and SQL tests should verify important collision constraints.
- Existing schema does not use DB foreign-key references. For Phase 2A, keep referenced-axis/allocation existence checks as Phase 2B/3 store/service validation unless a follow-up explicitly introduces SQLite foreign keys across registry tables.
- Key decisions for ontology tables: `ontology_namespace` uses `ontology_id` as primary key plus a secondary unique constraint/index for `namespace`; `ontology_axis` uses composite primary key `(ontology_id, axis_id, version_id)`; `ontology_taxonomy` uses composite primary key `(ontology_id, taxonomy_id, version_id)`; `ontology_address_allocation` uses `allocation_id` as primary key plus secondary unique constraints/indexes for `(prefix, version_id)` and `(ontology_id, taxonomy_id, version_id)`; `ontology_address_segment` uses composite primary key `(allocation_id, segment_id)`.
- Secondary unique constraints are not present in the current registry schema. When Phase 2A adds them, prefer explicit `uq_<table>_<columns>` names to distinguish them from existing non-unique `idx_...` lookup indexes.
- Migration/test pattern: source migrations live under `packages/registry-service/drizzle/**`; the initial migration includes `snapshot.json`, later hand-written/generated migrations currently have `migration.sql` only, and there is no committed `drizzle/meta/_journal.json`. SQL coverage currently lives in `src/app.sql.test.ts` through Nest `AppModule` plus the migrated SQL driver; ontology schema tests can extend that file or add a small migration-specific SQL test that initializes the registry-service migrations and asserts table creation plus uniqueness failures.

- [x] `registry-service/src/db/schema.ts`에 `ontology_namespace` 테이블 추가
  - [x] `ontology_id` primary key
  - [x] `namespace` unique
  - [x] `owner`, `lifecycle`, `created_at`, `updated_at`
- [x] `ontology_axis` 테이블 추가
  - [x] primary key `(ontology_id, axis_id, version_id)`
  - [x] `values_json`, `values_hash`, `capacity`, `lifecycle`
  - [x] `ontology_id` foreign key 또는 store-level existence check 결정
- [x] `ontology_taxonomy` 테이블 추가
  - [x] primary key `(ontology_id, taxonomy_id, version_id)`
  - [x] `applies_to_json`, `axis_ids_json`, `identity_axis_ids_json`, `space`, `lifecycle`
  - [x] referenced axis 존재 검증을 store/service 중 어디에서 수행할지 결정
- [x] `ontology_address_allocation` 테이블 추가
  - [x] `allocation_id` primary key
  - [x] unique `(prefix, version_id)`
  - [x] unique `(ontology_id, taxonomy_id, version_id)`
  - [x] `address_model`, `capacity`, `address_offset`, `address_size`, `status`
- [x] `ontology_address_segment` 테이블 추가
  - [x] primary key `(allocation_id, segment_id)`
  - [x] `consumes_json`, `address_offset`, `address_size`
- [x] schema implementation 전에 `operational-ontology-registry-persistence-handoff`의 registry-service test list를 확인하고 migration-backed SQL schema test로 분리
- [x] SQL migration/Drizzle schema snapshot 갱신

## Phase 2B: Store adapter — 완료

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

US-007 completion notes:

- `OntologyRegistryStore`는 dependency-free store contract와 structured conflict surface를 고정했다.
- shared validation helper는 exact duplicate key, same-key drift, missing taxonomy axis, invalid segment, segment overlap을 in-memory/SQL adapter 공통으로 판정한다.
- in-memory adapter는 cloned snapshot validation 뒤 maps를 교체해 no-partial-write를 보장한다.
- SQL adapter는 migrated table snapshot을 읽고 shared validation을 실행한 뒤 `SqlDriver.transaction()`으로 insert하며, SQLite unique constraint race는 revalidation/fallback duplicate conflict로 매핑한다.
- `createRegistryStores()`는 `:memory:`와 SQL path 모두에 `ontologyStore`를 노출한다.
- shared store contract test, in-memory tests, SQL adapter tests, bootstrap parity tests가 Phase 2B adapter behavior를 검증한다.

- [x] `OntologyRegistryStore` interface 추가
- [x] `InMemoryOntologyRegistryStore` 추가
- [x] `SqlOntologyRegistryStore` 추가
- [x] table별 duplicate/collision 테스트 추가
- [x] store-level list/get query 추가: namespace, taxonomy, allocation, active allocation

## Phase 3: Registry-service service layer — 완료

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
- `pnpm --filter operational-ontology test -- allocation`
- `node packages/cli/dist/index.js def validate`

US-008 completion notes:

- `OntologyRegistryService`는 `OntologyRegistryStore`만 소비하고 raw SQL을 직접 접근하지 않는 internal service boundary로 고정됐다.
- `OntologyModule`은 `DATABASE` 기반 `SqlOntologyRegistryStore` provider와 service provider를 export하지만 controller, REST route, CLI command를 추가하지 않는다.
- `registerOntologyPack()`와 pack-based `reserveAddressSpace()`는 `validateOperationalOntologyPack()`을 먼저 실행하고, invalid pack이면 allocation projection/store write를 호출하지 않는다.
- `reserveAddressSpace(schema, policy)`는 allocation projection과 plan validation을 실행한 뒤 `status: "reserved"`로 정규화해 store에 complete write set을 전달한다.
- `activateAllocation()`은 `reserved -> active`만 허용하고, active/deprecated 재활성화와 active `(prefix, versionId)` collision을 service-level error로 막는다.
- `syncToPrefixRegistry()`는 active allocation precondition과 deferred Phase 4 report shape만 반환하며 index-meta write를 수행하지 않는다.
- Service error code는 `invalid-pack`, `invalid-allocation-plan`, `duplicate-allocation`, `invalid-transition`, `missing-allocation`, `sync-precondition-failure`로 고정됐다.

- [x] `OntologyRegistryService` 추가
- [x] `registerOntologyPack(pack, options)` 구현
  - [x] `validateOperationalOntologyPack(pack)` 선행
  - [x] invalid pack은 namespace/axis/taxonomy/allocation 저장 금지
  - [x] packId를 기본 `ontologyId`로 사용
- [x] `reserveAddressSpace(input)` 구현
  - [x] `allocateOntologyAddressSpace()` 호출
  - [x] allocation collision guard 적용
  - [x] status는 기본 `reserved`
- [x] `activateAllocation(allocationId)` 구현
  - [x] reserved → active만 허용
  - [x] deprecated allocation은 재활성화 금지
  - [x] active prefix/version 중복 방지
- [x] `syncToPrefixRegistry(allocationId)` 구현
  - [x] active allocation만 sync 허용
  - [x] sync 결과를 audit/report record로 반환
- [x] service-level rollback/partial failure 정책 결정
  - [x] store adapter transaction으로 닫히지 않는 pack validation/reservation/activation orchestration boundary 결정
- [x] registry-service module/controller 노출 여부 결정
  - [x] 내부 service only
  - [x] REST endpoint 미노출
  - [x] CLI-only adapter 미노출
- [x] service unit test 추가: valid pack → reserved allocation
- [x] service unit test 추가: invalid pack → no write
- [x] service unit test 추가: duplicate prefix/version → error

## Phase 4: index-meta sync — 완료

Goal: active allocation을 index-meta prefix registry/schema version contract로 내리고 idempotency, collision, capacity drift 정책을 고정한다.

Non-goals: Phase 2 persistence schema 재설계, address_state_cache 계산, full activation smoke helper 구현.

Prerequisites:

- Phase 1 완료.
- Phase 3의 active allocation contract 또는 동등한 handoff fixture.
- `operational-ontology-index-meta-sync-handoff`에서 active allocation sync input, product/sum materialization, idempotency/collision, activation smoke checks 확인.
- index-meta sync 표현 방식 결정은 Phase 2A/2B persistence tasks의 선행조건이 아니다.

Validation commands:

- `pnpm --filter index-meta test`
- `pnpm --filter index-meta typecheck`
- `pnpm --filter index-meta build`
- `pnpm --filter registry-service test`
- `node packages/cli/dist/index.js def validate`

US-009 completion notes:

- `OntologyIndexMetaSyncAdapter`는 `packages/registry-service/src/modules/ontology/` 안의 type-first adapter boundary로 고정됐다. Adapter dependency는 `PrefixRegistry`와 schema-version store의 `getSchemaVersion()`/`insertSchemaVersion()` method로 제한한다.
- `OntologyRegistryService.syncToPrefixRegistry()`는 active allocation precondition을 유지하면서 namespace, taxonomy, taxonomy 순서의 axes, segments bundle을 수집해 adapter에 전달한다. Production service fallback은 없으며 deferred behavior는 테스트 fake에서만 명시적으로 사용한다.
- Product allocation은 namespace/axis 기반 deterministic axis leaf prefix, taxonomy `axisIds` 순서의 composite allocation prefix refs, matching schema version records를 materialize한다. Product segment는 parent shape evidence로 검증하고 별도 segment row를 쓰지 않는다.
- Sum allocation은 allocation prefix/schema만 leaf target으로 materialize하고 segment ranges는 `coveragePolicy: "exact-allocation-range"` sidecar report로 보존한다. `prefix_ref` rows는 index-meta segment model이 생길 때까지 deferred semantics로 남긴다.
- Sync는 전체 intended prefix/schema target set을 먼저 preflight한다. Existing matching records는 idempotent, safe partial target은 repaired, capacity/refs/schema/segment coverage drift는 blocked report로 반환하며 missing write를 진행하지 않는다.
- Phase 4 smoke-level readback은 report의 `postSyncChecks`로 제공한다. Product는 target prefix/schema 존재, ordered shape, last-valid/capacity resolver checks를 보고하고 sum은 sidecar exact coverage를 보고한다. Phase 5 activation helper는 이 surface를 소비하되 Phase 4 sync adapter 내부에 activation orchestration을 넣지 않는다.

- [x] `operational-ontology-index-meta-sync-handoff`로 handoff-only sync contract 작성
- [x] active allocation → `index-meta.prefix_registry` 등록
- [x] active allocation → `index-meta.schema_version` 등록
- [x] product allocation의 shape/refs 표현 방식 결정
  - [x] axis는 leaf prefix로 단일 capacity 등록
  - [x] taxonomy axis를 child refs로 materialize
  - [x] 기존 `PrefixRegistryRecord.refs`와의 매핑 규칙 정의
- [x] sum allocation의 `ontology_address_segment` → index-meta segment/sum model 연결 방식 결정
  - [x] 현재 index-meta에는 segment table이 없으므로 segment ranges는 sidecar report로 defer
  - [x] sum segment는 `prefix_ref` row로 쓰지 않고 `coveragePolicy: "exact-allocation-range"`로 검증
- [x] initial `entry` materialization 필요 조건 정의
  - [x] axis values entry materialization은 별도 explicit entry story까지 defer
  - [x] taxonomy product 조합은 lazy decode로 유지
- [x] sync idempotency 테스트 추가
- [x] `prefix_registry` already exists 처리 정책 결정
  - [x] same allocation shape이면 no-op
  - [x] other allocation/drift shape이면 collision error
- [x] `schema_version` capacity drift 감지 테스트 추가
- [x] `address_state_cache` 계산은 후속 validation phase로 보류

## Phase 5: Activation smoke — 완료

Goal: pack activation helper와 smoke checks로 valid/invalid/duplicate lifecycle 결과를 끝까지 검증한다.

Non-goals: 새 persistence table 추가, scoped prefix API 변경, address_state_cache validation phase 구현.

Prerequisites:

- Phase 3 service layer 완료.
- full prefix registry resolve/decode smoke는 Phase 4 index-meta sync 완료.
- invalid pack no-write와 duplicate prefix blocked smoke는 Phase 4 없이도 Phase 3 store/service boundary에서 먼저 실행 가능하다.

Validation commands:

- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `pnpm --filter index-meta test`
- `pnpm --filter index-meta typecheck`
- `pnpm --filter index-meta build`
- `pnpm --filter operational-ontology test -- allocation`
- `node packages/cli/dist/index.js def validate`

US-009 completion notes:

- `OntologyPackActivationHelper`는 ontology module provider로 노출되며 `registerOntologyPack`, `activateAllocation`, `syncToPrefixRegistry` service port만 호출한다.
- Valid pack activation은 `registerOntologyPack()`이 반환한 모든 allocation을 `reserved -> active`로 전이한 뒤 allocation별 index-meta sync와 smoke checks를 실행한다.
- Product smoke는 allocation active status, intended product prefix record readback, schema-version/prefix capacity agreement, ordered product shape, last-valid resolver, capacity out-of-range resolver를 검증한다.
- Sum smoke는 allocation active status, sum leaf prefix/schema capacity, `postSyncChecks.sumAllocation` exact-allocation-range sidecar coverage만 검증한다. Product shape/resolver smoke는 sum segment에 재사용하지 않는다.
- Invalid pack/invalid allocation-plan no-write와 blocked sync no-write는 real `OntologyRegistryService` + memory/SQL backend matrix로 검증하며, registry rows는 store APIs, SQL index-meta rows는 table counts로 확인한다.
- Activation payload는 raw `namespaceRecord`, `allocations`, `activationStatuses`, `syncReports`, `smokeChecks`를 보존하고 public summary용 `namespaceSummary`, `allocationSummaries`, `syncSummariesByAllocationId`, `smokeCheckSummary`, `warnings`, `errors`를 함께 노출한다.

- [x] end-to-end helper 정의: `activateOntologyPack(pack, options)`
- [x] flow 단계 고정
  - [x] pack validation
  - [x] namespace record write
  - [x] axis/taxonomy registration
  - [x] address allocation reservation
  - [x] allocation activation
  - [x] index-meta sync
  - [x] smoke resolve/decode
- [x] activation smoke 테스트: valid pack → allocation active → prefix registry/post-sync smoke
- [x] activation smoke 테스트: invalid pack → no allocation persisted
- [x] activation smoke 테스트: duplicate prefix → blocked
- [x] activation result payload 정의
  - [x] namespace record
  - [x] allocation records
  - [x] index-meta sync summary
  - [x] warnings/errors
- [x] activation issue/report에 allocation drift context 추가
- [x] operational-ontology pack registry와 registry-service activation flow 연결 문서화

## Phase 6: Prefix policy

Goal: global prefix uniqueness 유지/변경 기준을 결정하고, scoped prefix가 필요한 경우의 API/index-meta/decode migration surface를 분리한다.

Non-goals: 즉시 prefix table schema 변경, `/prefixes/:prefix` API v2 구현, index-meta key shape migration 실행.

Prerequisites:

- Phase 1 완료.
- Phase 2A/2B는 global prefix uniqueness와 `ontology_address_allocation` collision guard를 유지한 상태로 진행 가능하다.
- scoped prefix가 필요하다는 evidence가 생기면 `operational-ontology-scoped-prefix-decision`의 criteria를 통과한 뒤 별도 implementation ADR로 Phase 6을 닫는다.

Validation commands:

- `pnpm --filter operational-ontology test`
- `pnpm --filter operational-ontology typecheck`
- `pnpm --filter operational-ontology build`
- `node packages/cli/dist/index.js def validate`

- [x] 단기 정책 명시: 기존 `registry-service.prefix` global uniqueness 유지
- [x] `ontology_address_allocation`이 prefix/version collision guard를 맡는다는 ADR 작성
- [x] catalog scoped prefix가 필요한 구체 시나리오 수집
  - [x] 동일 prefix 이름을 서로 다른 ontology에서 독립 사용
  - [x] 동일 catalog 내 pack별 prefix 충돌
  - [x] 외부 tenant별 ontology namespace 분리
- [x] API v2 후보 설계
  - [x] `(catalog_id, prefix)`
  - [x] `(ontology_id, prefix)`
  - [x] global prefix + allocation namespace
- [x] 기존 `/prefixes/:prefix` API 영향 분석
- [x] index-meta key shape 영향 분석
- [x] decode-service/cache key 영향 분석
- [x] migration plan 작성 여부 결정
- [x] 최종 결정 전까지 registry-service prefix table schema 변경 금지

## Cross-phase 검증

- [x] `pnpm --filter registry-service test`
- [x] `pnpm --filter registry-service typecheck`
- [x] `pnpm --filter registry-service build`
- [x] `pnpm --filter index-meta test`
- [x] `pnpm --filter index-meta typecheck`
- [x] `pnpm --filter index-meta build`
- [x] `pnpm --filter operational-ontology test -- allocation`
- [x] `node packages/cli/dist/index.js def validate`

## 다음 구현 기준

Phase 5 activation smoke까지 완료됐다. Phase 2A schema/migration/snapshot, Phase 2B store adapter, Phase 3 service layer, Phase 4 index-meta sync, Phase 5 activation helper/smoke는 prefix global uniqueness를 깨지 않는다. 다음 구현은 현재 없다. scoped prefix는 `operational-ontology-scoped-prefix-decision`의 concrete need gate를 통과하고 새 decision PRD/implementation ADR이 생성되는 경우에만 별도 진행한다.
