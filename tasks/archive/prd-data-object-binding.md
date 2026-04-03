# PRD: data-object-binding — DataSchema ↔ prefix 좌표 바인딩

## Overview

DataSchema를 prefix 주소 공간에 바인딩하여 데이터 인스턴스를 좌표로 식별 가능한 객체로 만들고, 필드 단위 계보 추적의 기반을 제공한다.

현재 DataSchema, StepDataContract, FieldLineage가 개별 존재하지만 "이 스키마가 어떤 prefix에 좌표화되는가"를 선언하는 바인딩이 없다. 이 갭을 메우면 계보 추적 시 주소 맥락을 복원할 수 있다.

설계 시점(design-time) 제약이며 런타임 비용 0.

## Goals

- DataSchema → prefix 바인딩을 타입 시스템과 검증으로 강제
- 바인딩 정합성을 CI에서 자동 검증 (스키마 컬럼 ↔ prefix dim 매핑)
- 계보 체인의 양쪽이 바인딩되어 있는지 검증
- 제네릭 타입(수동)과 codegen(자동) 모두 지원
- SQLite 영속으로 바인딩 + 검증 결과 이력 관리

## Quality Gates

모든 유저 스토리에서 다음 명령이 통과해야 한다:
- `pnpm --filter @qa-sdk/core test`
- `pnpm --filter codegen-core test`
- `pnpm --filter data-object-codegen test` (US-005 이후)
- `pnpm --filter pipe-store-sqlite test` (US-006 이후)

## User Stories

### US-001: DataObjectBinding 타입 + BoundDataObject 제네릭 정의
**Description:** 개발자로서 DataSchema와 prefix의 바인딩을 타입으로 선언하고 제네릭으로 사용할 수 있어야 한다.

**Acceptance Criteria:**
- [ ] `core/src/data-object/types.ts`에 `DataObjectBinding`, `ColumnAxisMapping` 인터페이스 정의
- [ ] `BoundDataObject<S extends string, P extends string>` 제네릭 타입 정의
- [ ] `DataObjectBinding`에 schemaId, schemaVersion, prefixId, prefixVersion, columnToAxis 필드
- [ ] `ColumnAxisMapping`에 dimLabel, segmentId?(sum용) 필드
- [ ] `core/src/data-object/index.ts` barrel export
- [ ] `core/src/index.ts`에서 re-export
- [ ] 빌드 통과 (`pnpm --filter @qa-sdk/core build`)

### US-002: BindingRegistry 인메모리 구현
**Description:** 개발자로서 바인딩을 등록/조회/삭제할 수 있는 인메모리 레지스트리가 필요하다.

**Acceptance Criteria:**
- [ ] `core/src/data-object/registry.ts`에 `BindingRegistry` 클래스
- [ ] `register(binding)` — 등록 (중복 시 에러)
- [ ] `getBySchema(schemaId)` → `DataObjectBinding | null`
- [ ] `getByPrefix(prefixId)` → `DataObjectBinding[]`
- [ ] `listAll()` → 전체 목록
- [ ] `remove(schemaId)` → boolean
- [ ] 테스트: CRUD 5건 이상

### US-003: validateBindings — 카탈로그 기반 정합성 검증
**Description:** CI에서 바인딩이 카탈로그와 정합한지 자동 검증해야 한다.

**Acceptance Criteria:**
- [ ] `core/src/data-object/validate.ts`에 `validateBindings(bindings, catalog)` 함수
- [ ] 검증: identity 컬럼이 columnToAxis에 매핑되어 있는지
- [ ] 검증: dimLabel이 prefix.dims에 존재하는지
- [ ] 검증: sum 모델 segmentId가 해당 version segments에 존재하는지
- [ ] 검증: 같은 prefix에 중복 바인딩 없는지
- [ ] `BindingValidation` 반환 타입 (errors + warnings)
- [ ] 테스트: 정상 + 에러 케이스 각 3건 이상

### US-004: validateLineageChain — 계보 체인 검증
**Description:** 시뮬레이션 후 계보의 양쪽 스키마가 바인딩되어 있는지 검증해야 한다.

**Acceptance Criteria:**
- [ ] `validateLineageChain(lineages, registry)` 함수
- [ ] 결과: bound(바인딩 있음), unbound(경고), mismatched(dim 불일치) 카운트
- [ ] source와 target 모두 바인딩 있으면 bound
- [ ] 한쪽이라도 바인딩 없으면 unbound (에러 아닌 경고)
- [ ] 바인딩은 있지만 dim 매핑이 불일치하면 mismatched
- [ ] 테스트: bound/unbound/mismatched 각 1건 이상

### US-005: data-object-codegen 패키지 — 카탈로그 기반 바인딩 코드 자동 생성
**Description:** 카탈로그 + 스키마 정의에서 typed binding 코드를 자동 생성하는 별도 codegen 패키지가 필요하다.

**Acceptance Criteria:**
- [ ] `packages/data-object-codegen/` 패키지 생성 (tsup, vitest)
- [ ] `generateDataObjectBindings(catalog, schemas, bindings)` → `CodegenResult`
- [ ] 생성 파일 `data-objects.ts`: prefix별 typed interface (axis entries 리터럴 유니온)
- [ ] 생성 파일 `binding-registry.ts`: 바인딩 레지스트리 초기화 코드
- [ ] 생성 파일 `lineage-types.ts`: 스키마 간 유효 계보 타입
- [ ] 생성 파일 `index.ts`: barrel export
- [ ] contentHash 결정론적 (같은 입력 → 같은 hash)
- [ ] 테스트: 생성 파일 수, 타입명, hash 결정론성

### US-006: pipe-store-sqlite에 bindings + lineage_validations 테이블 추가
**Description:** 바인딩과 검증 결과를 SQLite에 영속하여 이력을 관리해야 한다.

**Acceptance Criteria:**
- [ ] `pipe-store-sqlite/src/db/schema.ts`에 `data_object_bindings` 테이블 추가
- [ ] `pipe-store-sqlite/src/db/schema.ts`에 `lineage_validations` 테이블 추가
- [ ] `bindings`: schemaId(PK), prefixId, prefixVersion, columnToAxis(JSON), createdAt
- [ ] `lineage_validations`: id(PK), schemaId, validatedAt, bound, unbound, mismatched, details(JSON)
- [ ] drizzle 마이그레이션 생성 + IF NOT EXISTS 적용
- [ ] `SqliteBindingStore` 클래스: save/get/list/remove
- [ ] `SqliteLineageValidationStore` 클래스: save/getLatest/listBySchema
- [ ] 테스트: CRUD + 검증 결과 저장/조회

### US-007: pipe 통합 — definition-bridge + simulate 연동
**Description:** 기존 pipe 모듈에서 BindingRegistry를 활용하여 바인딩 기반 계보를 추적해야 한다.

**Acceptance Criteria:**
- [ ] `pipe-definition-bridge.ts`에 `resolveBindings(graph, registry)` 추가 — 파이프별 바인딩 조회
- [ ] `pipe-bridge.ts`에서 시뮬 후 `validateLineageChain` 호출 가능
- [ ] 바인딩이 없는 파이프에 대해 경고 (에러 아닌 warning)
- [ ] 테스트: 바인딩 있는 파이프 + 없는 파이프 혼합 그래프

## Functional Requirements

- FR-1: DataObjectBinding은 schemaId+prefixId 조합이 유일해야 한다
- FR-2: columnToAxis의 dimLabel은 해당 prefix.dims에 존재해야 한다
- FR-3: sum 모델 prefix의 segmentId는 해당 version.segments에 존재해야 한다
- FR-4: 제네릭 BoundDataObject<S,P>와 codegen 생성 타입은 호환되어야 한다
- FR-5: codegen 생성 코드는 data-object 패키지 없이도 컴파일 가능해야 한다 (standalone)
- FR-6: lineage_validations는 검증 시점별 스냅샷으로 이력 추적 가능해야 한다
- FR-7: 런타임(이벤트 발행/수집) 경로에 DataObjectBinding이 개입하지 않아야 한다

## Non-Goals

- 런타임 주소 인코딩/디코딩 변경 (기존 encodePrefix/encodeBySegment 유지)
- DataObjectBinding 기반 자동 encodePrefix 호출 (SDK 래퍼)
- GraphQL/REST API 노출 (서비스 연동은 별도)
- 바인딩 UI 에디터

## Technical Considerations

- core의 data-object/ 디렉토리는 pipe/, standards/, catalog/와 동일한 sub-barrel 패턴
- codegen은 기존 generateCatalogTypes(codegen-core)와 동일 패턴: 순수 함수, I/O 없음, 파일 배열 반환
- SQLite 스키마는 pipe-store-sqlite의 기존 마이그레이션에 추가 (새 마이그레이션 파일)
- 제네릭 타입과 codegen 타입이 호환되려면 BoundDataObject의 타입 파라미터가 string literal union이어야 함

## Success Metrics

- 바인딩 선언 없이 DataSchema 사용 시 검증 경고 발생
- CI에서 validateBindings 통과율 100%
- 계보 추적 시 bound 비율 ≥ 80% (unbound는 경고만)
- codegen 생성 코드가 별도 컴파일 통과

## Open Questions

- 바인딩 선언의 SSOT는 카탈로그 파일 내인가, 별도 binding 파일인가?
- codegen이 DataSchema 정의를 어디서 읽는가? (카탈로그에 포함? 별도 파일?)
