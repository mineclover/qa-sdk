[PLAN]
# Indexing Merge Plan

## Overview

`permission-engine`, `index-meta`, `weighted-index`, `decode-service`에 흩어진 같은 목적의 순수 로직을 병합한다. 목표는 공개 API를 급격히 깨지 않으면서, 인코딩/디코딩/스키마 해석의 단일 책임 지점을 만드는 것이다.

이번 병합은 "새 아키텍처를 한 번에 도입"하는 작업이 아니라, **계약 테스트로 현재 동작을 고정한 뒤 내부 구현을 공용 로직으로 수렴시키는 작업**으로 정의한다.

## Goals

- `PermissionCodec`의 주소 계산 로직을 공용 코덱으로 수렴
- `decode-service`가 서비스 계층답게 transport만 담당하도록 정리
- `index-meta` 내부의 schema/topology 순수 로직 중복 제거
- cross-package 계약 테스트를 기준으로 리팩터링 안전망 확보
- 문서에서 패키지 책임 경계를 현재 코드와 일치시키기

## Non-Goals

- `PermissionCodec` public API 즉시 제거
- packed `bigint` 기반 신규 주소 체계 도입
- `pipeline` 신규 패키지 구현
- FPGA/WASM/GPU 가속 착수
- `defineTable` 또는 `MetaRegistryInput` 중 하나를 즉시 삭제

## Target Ownership

### `weighted-index`

- 순수 수학 엔진
- `WeightedIndex`, `WeightedIndexBig`
- `LabelRegistry`, `PrefixCodec`, `createBinder`
- batch/가속 포트

### `index-meta`

- schema SSOT와 topology 해석
- `MetaRegistryInput` 기반 registry/runtime codec
- `MetaCodec`, `MetaResolver`, `PrefixDecoder`
- decode/query 관련 순수 로직

### `permission-engine`

- 권한 도메인 전용 API
- `PermissionSet`, `TernaryMask`, `ScopedEngine`, `PermCode`
- 공용 코덱 위에 얹힌 `PermissionCodec` thin adapter

### `decode-service`

- HTTP/Zod/error mapping/request lifecycle
- decoder pool 관리
- 순수 decode 규칙은 직접 소유하지 않음

## Merge Strategy

### Phase 0. 계약 고정

병합 전에 현행 동작을 먼저 고정한다.

#### 이미 확보된 계약

- `packages/demo-tests/src/permission-engine/compat-contract.test.ts`
- `packages/demo-tests/src/index-meta/schema-authoring-contract.test.ts`

#### 추가할 계약

- invalid input parity
  - unknown label
  - parse error
  - partial bind 누락값
- multi-version parity
  - v1/v2 위치 안정성 또는 의도된 변화
- decode deep parity
  - unresolved ref 목록이 서비스와 라이브러리에서 동일

#### Acceptance Criteria

- `pnpm --filter permission-engine test`
- `pnpm --filter index-meta test`
- `pnpm --filter @qa-sdk/decode-service test`
- `pnpm --filter @qa-sdk/demo-tests test`

위 4개가 모두 통과해야 다음 단계로 진행한다.

### Phase 1. `PermissionCodec` 내부 어댑터화

`permission-engine`의 가장 큰 중복은 자체 주소 계산 로직이다. 첫 병합 대상은 이 부분이다.

#### 변경 원칙

- `PermissionCodec` public API는 유지
- 내부 구현만 공용 코덱 호출로 교체
- `serialize()` 포맷은 그대로 유지

#### 작업

- `permission-engine` 내부에 adapter layer 추가
  - 예: `src/internal/permission-address-codec.ts`
- `PermissionCodec.encodeRaw()`가 직접 map/stride를 계산하지 않고 공용 코덱을 호출하도록 변경
- `PermissionCodec.decode()`도 공용 decode 경로 사용
- 기존 `CodecDims` 입력 포맷은 유지

#### 예상 영향 파일

- `packages/permission-engine/src/permission-codec.ts`
- `packages/permission-engine/src/index.ts`
- `packages/demo-tests/src/permission-engine/compat-contract.test.ts`

#### Stop Condition

- `PermissionCodec` public shape가 바뀌려는 순간 중단
- `permission-engine` 단위 테스트와 `demo-tests` parity가 동시에 깨지면 내부 adapter API를 더 얇게 조정한 뒤 재시도

### Phase 2. `PrefixDecoder`가 unresolved 규칙 소유

현재 `decode-service` 라우트가 일부 decode domain logic을 직접 갖고 있다. 이 단계에서 서비스는 transport 계층으로 축소한다.

#### 변경 원칙

- unresolved ref 계산은 `index-meta` pure logic으로 이동
- 서비스 응답 shape는 유지

#### 작업

- `index-meta`에 unresolved 정보 포함 decode helper 추가
  - 예: `decodeDeepDetailed()` 또는 `collectUnresolvedRefs()`
- `decode-service/routes/decode.ts`는 해당 helper만 호출
- 서비스 테스트는 HTTP contract만 검증

#### 예상 영향 파일

- `packages/index-meta/src/prefix-decoder.ts`
- `packages/index-meta/src/decode.ts`
- `packages/decode-service/src/routes/decode.ts`
- `packages/decode-service/src/app.test.ts`

#### Acceptance Criteria

- `decode-service` 라우트 내부에서 `DecodeMap` 순회 규칙이 사라진다
- unresolved 응답이 기존과 동일하다

### Phase 3. `index-meta` topology 순수 로직 단일화

`MetaRegistryInput` 경로와 `defineTable/compileSchema` 경로가 같은 종류의 topology 정보를 중복 계산하는 부분을 하나로 모은다.

#### Canonical Rule

- **canonical schema data model은 `MetaRegistryInput`으로 둔다**
- `defineTable`은 삭제 대상이 아니라, topology projection을 만드는 authoring DSL로 축소한다

이 선택 이유:

- `createIndexSDK`, README, 다수 문서가 이미 `MetaRegistryInput`을 중심으로 서 있다
- `defineTable`만으로는 entry snapshot 전체를 표현하지 못한다

#### 작업

- 공용 topology builder 추출
  - 예: `src/schema-topology.ts`
- `MetaRegistry`와 `syncSchemaToRegistry()`가 같은 topology builder를 사용하도록 정리
- `compileSchema()`는 registry sync용 topology projection만 생성하도록 역할을 명확히 함

#### 예상 영향 파일

- `packages/index-meta/src/meta-registry.ts`
- `packages/index-meta/src/index-sdk.ts`
- `packages/index-meta/src/compile-schema.ts`
- `packages/index-meta/src/schema-sync.ts`
- `packages/index-meta/src/table-def.ts`
- `packages/demo-tests/src/index-meta/schema-authoring-contract.test.ts`

#### Acceptance Criteria

- shape/capacity/refs 계산 경로가 한 군데로 수렴
- 기존 `MetaRegistryInput` 소비 코드가 깨지지 않음
- `defineTable` 기반 테스트가 유지됨

### Phase 4. 중복 테스트와 설명의 소유권 정리

동일 개념을 여러 곳에서 "실질 구현 문서"처럼 들고 있는 테스트와 설명을 줄인다.

#### 작업

- `permission-engine/src/composite-address.test.ts`의 역할 축소
  - 패키지 로컬 유닛 검증만 남김
- cross-package 계약은 `demo-tests`로 이동 유지
- 패키지 README/스펙에서 canonical package를 명시

#### Acceptance Criteria

- 동일 개념의 canonical 설명 위치가 하나로 정리됨
- 패키지 테스트와 통합 테스트의 책임이 분리됨

### Phase 5. 문서 동기화

리팩터링이 끝난 뒤 한 번에 문서를 정리하지 말고, 각 phase 종료 시 바로 반영한다.

#### 즉시 업데이트 대상

- `packages/demo-tests/README.md`
- `docs/specs/indexing/README.md`
- `docs/specs/spec.todo.md`
- `docs/specs/todo-plan.md`

#### 병합 방향 확정 후 업데이트 대상

- `docs/specs/indexing/foundation.md`
- `packages/index-meta/README.md`
- `docs/specs/services/decode-service.spec.md`

#### 문서 규칙

- 스펙은 현재 구현 상태만 반영
- 미래 계획은 이 문서(`tasks/indexing-merge-plan.md`)에 유지
- `todo-plan.md`는 패키지 배치 계획만 남기고 세부 병합 순서는 여기로 이동

## PR Split

### PR-1 계약 테스트 보강

- Phase 0만 수행
- 문서: `demo-tests` README와 테스트 수치만 업데이트

### PR-2 `PermissionCodec` adapter 전환

- Phase 1 수행
- 외부 API 불변

### PR-3 decode pure logic 이동

- Phase 2 수행
- `decode-service`를 transport thin layer로 축소

### PR-4 topology builder 단일화

- Phase 3 수행
- `index-meta` 내부 중복 제거

### PR-5 문서/잔여 정리

- Phase 4, 5 수행
- stale 설명 제거

## Quality Gates

각 PR마다 아래 명령을 기본 게이트로 둔다.

```bash
pnpm --filter weighted-index test
pnpm --filter index-meta test
pnpm --filter permission-engine test
pnpm --filter @qa-sdk/decode-service test
pnpm --filter @qa-sdk/demo-tests test
```

구조 변경이 들어간 PR에서는 typecheck도 같이 건다.

```bash
pnpm --filter weighted-index typecheck
pnpm --filter index-meta typecheck
pnpm --filter permission-engine typecheck
pnpm --filter @qa-sdk/decode-service typecheck
```

## Exit Criteria

- `PermissionCodec`이 공용 코덱 기반 thin adapter로 동작한다
- `decode-service`가 순수 decode 규칙을 직접 소유하지 않는다
- `index-meta`의 topology 계산이 단일 경로로 정리된다
- cross-package 계약 테스트가 병합 후에도 모두 통과한다
- 문서가 새 책임 경계를 반영한다

## Risks

- `PermissionCodec`의 현재 동작이 사실상 legacy contract라, 잘못된 행동도 함께 고정할 수 있음
- `defineTable` 경로와 `MetaRegistryInput` 경로는 완전 동일하지 않아서, topology 병합 범위를 과도하게 잡으면 리팩터링이 커질 수 있음
- `decode-service` 테스트가 pure logic 이동 후에도 라우트 책임을 충분히 검증하도록 유지되어야 함

## Recommended First Move

실행 순서는 아래가 가장 안전하다.

1. Phase 0 보강 테스트 추가
2. `PermissionCodec` 내부 adapter 전환
3. `PrefixDecoder` unresolved 규칙 이동
4. `index-meta` topology builder 단일화
5. 문서 정리
