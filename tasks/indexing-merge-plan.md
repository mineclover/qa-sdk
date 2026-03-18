[PLAN]
# Indexing Merge Plan

## Overview

`permission-engine`, `index-meta`, `weighted-index`에 걸쳐 **같은 의미의 연산이 다른 구현**으로 존재하는 지점을 식별하고, 단일 canonical 구현으로 수렴시킨다.

핵심 원칙: **같은 의미가 다른 코드로 표현되면, 하나가 바뀔 때 나머지가 drift한다.** 이번 작업은 의미적 중복을 제거하되, 역할이 다른 모듈을 무리하게 합치지 않는다.

## 식별된 의미적 중복

코드 분석으로 확인된 실제 중복 지점:

### D-1. String→Index 맵 구축

`PermissionCodec._buildMap()`과 `LabelRegistry._buildCache()`가 동일한 "entity ID 배열 → 1-based index Map" 변환을 독립 구현한다.

```
PermissionCodec._buildMap()           LabelRegistry._buildCache()
─────────────────────────────         ─────────────────────────────
for (i = 0; i < ids.length; i++)     for (pos = 0; pos < ids.length; pos++)
  m.set(ids[i], i + 1)                idToIndex.set(id, pos + 1)
                                       indexToId.set(pos + 1, id)   // + 역방향
                                       // + -0 정규화
```

LabelRegistry가 더 완전하다 (양방향 + 정규화). PermissionCodec은 단방향만 자체 구현.

### D-2. Shape 배열 중복 구성 (meta-registry 내부)

`meta-registry.ts` 내에서 같은 shape 배열을 2곳에서 독립 구성한다:

| 경로 | 위치 | 목적 |
|---|---|---|
| `_getWeightedIndex()` | L1239-1242 | `shape = dims.map(d => entries.length)` → WeightedIndex 생성 |
| `serialize()` bigint guard | L723-725 | `shape = dims.map(d => entries.length)` → `computeShapeProductBig` 오버플로 체크 |

동일한 입력(IndexDef + snapshots)에서 동일한 배열을 재구성. 하나를 바꾸고 다른 하나를 잊으면 drift.

### D-3. Capacity 곱셈 경로 분기

shape의 총 용량(product)을 계산하는 경로가 분리되어 있다:

| 경로 | 위치 | 방식 |
|---|---|---|
| `compileSchema()` | compile-schema.ts L188 | `capacity *= refVersion.capacity` — refs를 순회하며 직접 곱셈 |
| `MetaRegistry._getWeightedIndex()` | meta-registry.ts L1239 | `entries.length` → WeightedIndex → `.size` — 암묵적으로 곱셈 |
| `MetaRegistry.serialize()` | meta-registry.ts L723 | `computeShapeProductBig(shape)` — BigInt 오버플로 체크 전용 |

같은 의미(전체 주소 공간 크기)를 3가지 다른 방식으로 계산. `schema-authoring-contract.test.ts`가 결과 일치를 검증하지만, **공식이 다르면 edge case에서 갈라질 수 있다.**

### D-4. Stride 공식 중복

`calcWeights()`와 `WeightedIndex` 생성자가 동일한 stride 공식(`W[i] = Π_{j>i} shape[j]`)을 각각 구현한다:

```
WeightedIndex 생성자 (L86-89)         calc.ts::calcWeights() (L38-42)
─────────────────────────────         ─────────────────────────────
weights[d-1] = 1                     shape.map((_, i) =>
for (i = d-2; i >= 0; i--)            shape.slice(i+1)
  weights[i] = w[i+1] * shape[i+1]     .reduce((p, n) => p * n, 1))
```

WeightedIndex는 성능 최적화(Float64Array, reverse loop), calcWeights는 가독성 우선. MetaCodec 등 외부 모듈은 `calcWeights()`를 사용하므로 두 구현의 결과가 반드시 일치해야 한다.

### D-5. Unresolved ref 개념 (경미)

"unresolved ref"의 **정의** 자체는 `PrefixDecoder.hasRef()`에 집중되어 있어 심각한 중복은 아니다. 다만 결과를 수집하는 패턴이 `decode-service` 라우트에만 존재하고, `PrefixDecoder` 자체는 이를 반환하지 않는다. 라이브러리가 이 개념을 소유하는 것이 자연스럽다.

## Non-Duplications (병합 대상 아님)

코드 분석에서 **의도적 분리**로 확인된 항목:

| 항목 | 이유 |
|---|---|
| MetaRegistry vs defineTable/compileSchema | 역할이 다름: 런타임 엔진 vs 빌드타임 authoring DSL |
| MetaRegistry vs PrefixRegistry | 역할이 다름: 중앙 SSOT vs 분산 소비용 최소 레코드 |
| decode-service 라우트 로직 | 이미 transport only. domain logic 없음 |
| PermissionCodec vs MetaCodec | 도메인이 다름: 고정 4D 권한 vs 임의 N-D 스키마. 의존 방향(index-meta)을 추가하면 안 됨 |

## Goals

- D-1 해소: `PermissionCodec`이 `LabelRegistry`를 재사용하여 맵 구축 중복 제거
- D-2 해소: `meta-registry.ts` 내부에서 shape 구성 경로를 단일화
- D-3 해소: capacity 곱셈에 공용 primitive 도입 + 계약 테스트로 경로 간 일치 보장
- D-4 해소: stride 공식의 canonical 구현을 하나로 지정, 다른 쪽이 위임
- D-5 해소: `PrefixDecoder`가 unresolved 수집 메서드를 직접 제공
- cross-package 계약 테스트를 기준으로 리팩터링 안전망 확보
- 문서에서 패키지 책임 경계를 현재 코드와 일치시키기

## Non-Goals

- `PermissionCodec` public API 변경
- `permission-engine`에 `index-meta` 의존 추가 (역의존)
- `defineTable`/`compileSchema`를 `MetaRegistry`와 병합
- packed `bigint` 기반 신규 주소 체계 도입
- `pipeline` 신규 패키지 구현
- FPGA/WASM/GPU 가속 착수
- `defineTable` 또는 `MetaRegistryInput` 중 하나를 즉시 삭제

## Target Ownership (변경 없음)

### `weighted-index`

- 순수 수학 엔진 + canonical primitives (stride, label→index)
- `WeightedIndex`, `WeightedIndexBig`
- `LabelRegistry`, `PrefixCodec`, `createBinder`
- `calcWeights()` — stride 공식의 canonical 구현
- batch/가속 포트

### `index-meta`

- schema SSOT와 topology 해석
- `MetaRegistryInput` 기반 registry/runtime codec
- `MetaCodec`, `MetaResolver`, `PrefixDecoder`
- decode/query 관련 순수 로직

### `permission-engine`

- 권한 도메인 전용 API
- `PermissionSet`, `TernaryMask`, `ScopedEngine`, `PermCode`
- `PermissionCodec`: `weighted-index`의 `LabelRegistry` + `WeightedIndex` 기반 thin adapter
- `index-meta`에 의존하지 않음 (weighted-index만 의존)

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

- **D-1 대비**: PermissionCodec._buildMap()과 LabelRegistry 산출물 동등성
  - 같은 ID 배열 입력 → 같은 index 매핑 결과
  - duplicate ID, 빈 배열, 특수문자 ID 경계 케이스
- **D-3 대비**: capacity 경로 간 일치
  - compileSchema capacity vs MetaRegistry.createCodec().size
  - 동일 shape에 대해 두 경로의 결과가 같음을 검증
- **D-4 대비**: stride 공식 일치
  - `calcWeights(shape)` === `new WeightedIndex(shape).strides`
  - 다양한 shape (1D, 고차원, 경계 크기)
- invalid input parity
  - unknown label
  - parse error
  - partial bind 누락값
- multi-version parity
  - v1/v2 위치 안정성 또는 의도된 변화

#### Acceptance Criteria

- `pnpm --filter permission-engine test`
- `pnpm --filter index-meta test`
- `pnpm --filter @qa-sdk/decode-service test`
- `pnpm --filter @qa-sdk/demo-tests test`

위 4개가 모두 통과해야 다음 단계로 진행한다.

### Phase 1. PermissionCodec → LabelRegistry 재사용 [D-1]

`PermissionCodec`이 `_buildMap()`을 자체 구현하는 대신 `weighted-index`의 `LabelRegistry`를 사용하도록 내부를 교체한다.

#### 변경 원칙

- `PermissionCodec` public API 완전 유지 (`CodecDims` 입력, encode/decode/serialize/parse`)
- 의존은 `weighted-index`에만 (현재와 동일, `index-meta` 추가하지 않음)
- `serialize()` 포맷 유지

#### 구체적 변경

```
Before:
  PermissionCodec
    ├─ _buildMap(ids) → Map<string, number>    // 자체 구현
    ├─ _serviceMap, _typeMap, _resourceMap, _actionMap
    └─ WeightedIndex(shape)

After:
  PermissionCodec
    ├─ LabelRegistry({ services: { v: "v1", ids }, ... })  // 위임
    ├─ WeightedIndex(shape)  // 변경 없음
    └─ encode: LabelRegistry.getIndex() → WeightedIndex.encode()
       decode: WeightedIndex.decode() → LabelRegistry.getEntityId()
```

- 4개의 `_*Map`을 제거하고, 단일 `LabelRegistry` 인스턴스로 교체
- LabelRegistry의 양방향 맵 + -0 정규화가 자동으로 적용됨
- `_resolve()` 헬퍼는 `LabelRegistry.getIndex()`로 대체

#### 예상 영향 파일

- `packages/permission-engine/src/permission-codec.ts` — 내부 구현 교체
- `packages/demo-tests/src/permission-engine/compat-contract.test.ts` — 동등성 검증 추가

#### Stop Condition

- `PermissionCodec` public shape가 바뀌려는 순간 중단
- `LabelRegistry` 생성자 입력 형식이 `CodecDims`와 맞지 않으면, 변환 어댑터를 만들되 LabelRegistry API를 변경하지 않음

### Phase 2. weighted-index 내부 stride 정리 [D-4]

`calcWeights()`와 `WeightedIndex` 생성자가 같은 stride 공식을 각각 구현하는 문제를 정리한다.

#### Canonical Rule

- **`calcWeights(shape)`가 stride 공식의 canonical 구현**으로 지정한다
- `WeightedIndex` 생성자는 `calcWeights()`를 호출하여 stride를 얻는다
- 성능이 필요한 경우 `calcWeights()` 내부를 최적화하되, 구현은 한 군데

#### 구체적 변경

```
Before:
  WeightedIndex 생성자: Float64Array reverse loop (독자 구현)
  calcWeights():        Array.map + slice + reduce (독자 구현)

After:
  calcWeights():        Float64Array reverse loop (성능 최적화된 단일 구현)
  WeightedIndex 생성자: this._weightsBuf = calcWeights(shape) 호출
```

- `calcWeights()`의 반환 타입을 `Float64Array`로 변경하거나, 내부에서 Float64Array를 만들고 `Array.from()`으로 반환
- WeightedIndex의 `_weightsBuf` 할당만 변경, encode/decode 로직은 불변
- 기존 `calcWeights()` 소비자(MetaCodec 등)의 API 호환 유지

#### 예상 영향 파일

- `packages/weighted-index/src/calc.ts` — canonical 구현으로 승격
- `packages/weighted-index/src/weighted-index.ts` — calcWeights() 호출로 교체
- `packages/weighted-index/src/calc-big.ts` — BigInt 버전도 동일 원칙 적용 검토

#### Acceptance Criteria

- Phase 0에서 추가한 stride 일치 테스트가 통과
- 기존 WeightedIndex 단위 테스트 전체 통과
- calcWeights() 소비자(MetaCodec 등) 동작 불변

### Phase 3. meta-registry shape/capacity 단일 경로 [D-2, D-3]

`meta-registry.ts` 내부에서 shape 배열을 중복 구성하는 문제와, capacity 곱셈이 여러 경로로 분산된 문제를 정리한다.

#### D-2: shape 구성 단일화

```
Before:
  _getWeightedIndex():  shape = dims.map(d => snapshot.entries.length) → new WeightedIndex(shape)
  serialize() bigint:   shape = dims.map(d => snapshot.entries.length) → computeShapeProductBig(shape)

After:
  _buildShape(def, snapshots): number[]   // private 헬퍼, 한 군데서 shape 구성
  _getWeightedIndex():  new WeightedIndex(this._buildShape(...))
  serialize() bigint:   computeShapeProductBig(this._buildShape(...))
```

shape 구성 로직을 `_buildShape()` private 메서드로 추출. 변경 시 한 군데만 수정.

#### D-3: capacity 일치 강화

`compileSchema()`의 capacity 곱셈과 `MetaRegistry`의 암묵적 capacity는 **입력이 다르기 때문에** (TableDef refs vs MetaRegistryInput entries) 단일 함수로 합칠 수 없다. 대신:

- Phase 0에서 추가한 **capacity 일치 계약 테스트**를 canonical 검증으로 유지
- `compileSchema()`에 주석으로 canonical capacity 공식을 명시: `capacity = Π(dim.entries.length)` → refs 경유 시 `Π(refVersion.capacity)`와 동치
- 두 경로가 다른 결과를 내면 계약 테스트가 즉시 감지

#### 예상 영향 파일

- `packages/index-meta/src/meta-registry.ts` — `_buildShape()` 추출
- `packages/index-meta/src/compile-schema.ts` — capacity 공식 주석 추가
- `packages/demo-tests/src/index-meta/schema-authoring-contract.test.ts` — capacity 일치 테스트 강화

#### Acceptance Criteria

- meta-registry.ts에서 `dims.map(d => snapshot.entries.length)` 패턴이 1회만 등장
- capacity 계약 테스트가 compileSchema capacity === MetaRegistry codec.size를 검증
- 기존 테스트 전체 통과

### Phase 4. PrefixDecoder unresolved 편의 메서드 [D-5]

`PrefixDecoder`가 unresolved ref 수집을 직접 제공하여, decode-service가 이 개념을 정의할 필요 없게 한다.

#### 구체적 변경

```ts
// packages/index-meta/src/prefix-decoder.ts 에 추가
class PrefixDecoder {
  // 기존 API 유지

  /** decodeDeep 결과에 unresolved ref 목록을 포함하여 반환 */
  decodeDeepDetailed(input: number | string): PrefixDeepDecodeDetailedResult {
    const result = this.decodeDeep(input);
    const unresolved: string[] = [];
    for (const dim of this._config.map.dims) {
      if (dim.kind.type === "index_ref" && !this.hasRef(dim.dimId)) {
        unresolved.push(dim.dimId);
      }
    }
    return { ...result, unresolved };
  }
}
```

- decode-service의 `/decode/deep` 라우트는 `decodeDeepDetailed()`만 호출
- 기존 `decodeDeep()`은 하위 호환을 위해 유지

#### 예상 영향 파일

- `packages/index-meta/src/prefix-decoder.ts` — `decodeDeepDetailed()` 추가
- `packages/decode-service/src/routes/decode.ts` — 라우트 내 수집 로직 제거, 메서드 호출로 교체
- `packages/decode-service/src/app.test.ts` — 응답 shape 동일 검증

#### Acceptance Criteria

- decode-service 라우트 내에서 `dim.kind.type === "index_ref"` 순회가 사라짐
- 기존 `/decode/deep` 응답 shape 완전 동일
- PrefixDecoder 단위 테스트에서 unresolved 수집 검증 추가

### Phase 5. 테스트 소유권 정리 + 문서 동기화

리팩터링 결과를 반영하여 테스트 책임과 문서를 정리한다.

#### 테스트 소유권

- `permission-engine` 패키지 내 테스트: 패키지 로컬 유닛 검증만 담당
- cross-package 동등성: `demo-tests`의 계약 테스트가 canonical
- `permission-engine/src/composite-address.test.ts`의 역할이 demo-tests 계약과 겹치면 축소

#### 문서 업데이트

각 phase 완료 시 즉시 반영:

- `packages/demo-tests/README.md` — 추가된 계약 테스트 반영
- `docs/specs/indexing/README.md` — canonical primitive 위치 명시
- `docs/specs/indexing/foundation.md` — stride 공식 canonical 구현 위치 기술
- `packages/index-meta/README.md` — shape 구성 단일 경로 반영
- `docs/specs/services/decode-service.spec.md` — decodeDeepDetailed 반영

#### 문서 규칙

- 스펙은 현재 구현 상태만 반영
- 미래 계획은 이 문서(`tasks/indexing-merge-plan.md`)에 유지
- Non-Duplication 섹션의 판단 근거를 `foundation.md`에 기록 (왜 분리가 의도적인지)

## PR Split

### PR-1 계약 테스트 보강

- Phase 0 수행
- D-1~D-5 중복 지점별 동등성/일치 테스트 추가
- 문서: `demo-tests` README 테스트 수치 업데이트

### PR-2 PermissionCodec → LabelRegistry 위임

- Phase 1 수행
- 외부 API 불변, 내부 _buildMap() 제거
- 의존: weighted-index만 (index-meta 추가 없음)

### PR-3 weighted-index stride 정리

- Phase 2 수행
- calcWeights()를 canonical로, WeightedIndex가 호출
- weighted-index 패키지 내부 변경만

### PR-4 meta-registry shape 단일화

- Phase 3 수행
- _buildShape() 추출 + capacity 계약 강화
- index-meta 패키지 내부 변경만

### PR-5 PrefixDecoder + 문서 정리

- Phase 4, 5 수행
- decodeDeepDetailed() 추가 + decode-service 라우트 단순화
- 문서/테스트 소유권 정리

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

- `PermissionCodec`이 `LabelRegistry`에 위임하여 string→index 맵 구축 중복이 제거된다
- `calcWeights()`가 stride 공식의 단일 canonical 구현이며, WeightedIndex가 이를 사용한다
- `meta-registry.ts` 내에서 shape 구성 경로가 하나로 수렴한다
- capacity 일치가 계약 테스트로 보장된다
- `PrefixDecoder`가 unresolved ref 수집을 직접 제공하고, decode-service는 이를 호출만 한다
- cross-package 계약 테스트가 병합 후에도 모두 통과한다
- 문서가 canonical 구현 위치와 의도적 분리 근거를 반영한다

## Risks

| 리스크 | 대응 |
|---|---|
| `LabelRegistry` 생성자 입력이 `CodecDims`와 형태가 달라 변환 비용 발생 | 변환 어댑터를 PermissionCodec 내부에 두되, LabelRegistry API는 변경하지 않음 |
| `calcWeights()` 반환 타입 변경 시 소비자 영향 | Float64Array 내부 사용 + Array.from() 반환으로 API 호환 유지 |
| capacity 경로가 근본적으로 다른 입력(refs vs entries)을 사용하므로 단일 함수 불가 | 함수 통합 대신 계약 테스트 + 공식 주석으로 의미적 동치를 보장 |
| `decodeDeepDetailed()` 추가 시 PrefixDecoder API 표면 확대 | 기존 `decodeDeep()`은 유지, 신규 메서드는 선택적 사용 |
| Phase 1에서 LabelRegistry의 EntityId 타입이 string 외 number도 허용하여 PermissionCodec과 차이 | CodecDims는 string[]이므로 LabelRegistry에 string으로 등록하면 문제 없음 |

## Recommended Execution Order

1. **Phase 0** — 계약 테스트 보강 (안전망 확보, 모든 후속 phase의 전제)
2. **Phase 2** — stride 정리 (weighted-index 내부, 영향 범위 가장 작음)
3. **Phase 1** — PermissionCodec 내부 교체 (Phase 2에서 정리된 weighted-index 기반)
4. **Phase 3** — meta-registry shape 단일화 (index-meta 내부)
5. **Phase 4** — PrefixDecoder 편의 메서드 (라이브러리 + 서비스 연결)
6. **Phase 5** — 문서 정리 (각 phase 완료 시 즉시 반영하되, 최종 점검은 마지막)
