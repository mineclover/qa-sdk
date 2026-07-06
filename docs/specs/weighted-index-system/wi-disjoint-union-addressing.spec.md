---
def:
  id: wi-disjoint-union-addressing
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  svc: weighted-index
  tags: [runtime, structural, addressing]
  links:
    - target: wi-system
      type: traces_to
    - target: wi-api
      type: refines
    - target: authorization-ontology-bitmap-pipeline
      type: traces_to
sources:
  - packages/weighted-index/src/vocab/union-index.ts
  - packages/weighted-index/src/vocab/union-index.test.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/bitmask.ts
  - packages/weighted-index/src/math/bitmask.test.ts
---

# Disjoint Union Addressing — 이종 shape의 합산 주소 공간

## 목적 ^purpose

weighted-index의 기본 `WeightedIndex`는 **product type** — 모든 축이 곱셈으로 결합되어 단일 mixed-radix 좌표를 형성한다. 그러나 권한 모델처럼 **서로 다른 kind가 각자의 shape을 가지면서 동일 address 공간을 공유해야 하는** 경우 product는 공간 낭비를 일으킨다.

본 스펙은 `DisjointUnionIndex`라는 composite primitive를 정의해 **sum type 주소 공간**을 제공한다. 여러 `WeightedIndex` 인스턴스를 disjoint offset으로 이어 붙여, 각 kind가 독립 shape을 유지하면서 하나의 bitmap·address 공간에 공존할 수 있게 한다.

근거 워크로드: `authorization-ontology-bitmap-pipeline` 스펙의 `target_kind ∈ {resource, transaction, ...}` 축. resource는 N_r개 entry, transaction은 N_t개 entry를 가지며 N_r ≠ N_t가 일반적.

## 구성 ^overview

`DisjointUnionIndex`는 여러 `WeightedIndex` 인스턴스를 감싸는 composite. 각 kind는 자기만의 sub-`WeightedIndex`와 offset을 갖는다.

```
address space:
  [0 .. size_0 - 1]                    → kind_0
  [size_0 .. size_0 + size_1 - 1]      → kind_1
  [size_0+size_1 .. +size_2 - 1]       → kind_2
  ...
total_size = Σ size_i
```

각 kind의 sub-WI는 자기 내부에서 일반 mixed-radix encoding 수행. kind 경계는 offset으로만 표현되므로 cross-kind 좌표 혼합은 불가능 (disjoint 보장).

## 정의 ^defines

### 1. 타입

```ts
export interface UnionVariant {
  /** kind 식별자 — 문자열 라벨 (":" 사용 금지, PrefixCodec 규약 상속). */
  kind: string;
  /** 이 kind의 sub-shape — 일반 WeightedIndex shape 규칙. */
  shape: number[];
  /** optional label 이름 (decodeToRecord 용). */
  labels?: readonly string[];
}

export class DisjointUnionIndex {
  constructor(variants: readonly UnionVariant[]);

  readonly totalSize: number;
  readonly kinds: readonly string[];

  /** kind + 좌표 → 전역 address (disjoint offset 반영). */
  encode(kind: string, coords: number[]): number;

  /** 전역 address → kind + 좌표. */
  decode(address: number): { kind: string; coords: number[] };

  /** 특정 kind의 [lo, hi] 전역 범위. */
  rangeOf(kind: string): [number, number];

  /** 특정 kind 내에서의 calcAddressRanges — 결과는 전역 address 범위. */
  calcAddressRanges(
    kind: string,
    pattern: (string | null)[],
  ): Array<[number, number]>;

  /** kind-aware bitmap 생성 (전체 union 공간). */
  createMask(): Uint8Array;

  /** 특정 kind의 WeightedIndex 인스턴스 접근 (고급 연산용). */
  getIndex(kind: string): WeightedIndex;
}
```

### 2. encode/decode 규약

#### 2.1 encode

```
encode(kind, coords):
  range = rangeOf(kind)  // [lo, hi]
  sub_address = getIndex(kind).encode(coords)
  return range.lo + sub_address
```

- `kind`가 등록되지 않았으면 `UnionKindError` 던짐
- `coords.length !== variant.shape.length` 이면 `CoordError`

#### 2.2 decode

```
decode(address):
  for variant in variants:
    if range[variant.kind].lo <= address <= range[variant.kind].hi:
      sub_address = address - range.lo
      return { kind: variant.kind, coords: getIndex(variant.kind).decode(sub_address) }
  throw IndexRangeError
```

- `address < 0` 또는 `address >= totalSize` 이면 `IndexRangeError`

### 3. 축 등록과 확장

- variants는 constructor에 **순서대로** 전달. 순서가 offset 할당을 결정.
- 새 kind 추가(variant append)는 허용 — 기존 kind의 offset이 바뀌지 않도록 **append-only**.
- 기존 kind의 shape 확장(sub capacity 증가)은 **뒤쪽 offset 재계산**을 유발하므로 **version bump 필요** (본 문서 §5 참조).

### 4. patternLattice / range 연산

- `calcAddressRanges(kind, pattern)`: 특정 kind 내에서 부분 좌표 패턴 → 전역 address 범위. 결과 ranges는 모두 해당 kind의 `[lo, hi]` 내부.
- **cross-kind 패턴은 지원하지 않음**. "모든 resource + 특정 transaction"은 두 kind의 결과를 application 레벨에서 union (`mergeRanges`)으로 합산.
- `patternMeet/Join`은 동일 kind 내에서만 성립. 다른 kind 간 meet은 빈 집합 (의미 불일치).

### 5. Version binding

`DisjointUnionIndex`는 version을 자체로 관리하지 않는다. 대신 상위 계층(`PrefixCodec` 또는 authorization의 `VersionedBitmap`)이 **union 전체를 하나의 version으로 취급**한다.

- variant 추가·shape 확장 → 새 version 발급 (unified versioning)
- 기존 version의 address는 해당 version 바인딩 안에서만 유효

이 결정은 `authorization-ontology-bitmap-pipeline.spec.md` §6 (Version binding)과 일치.

### 6. 에러

```ts
export class UnionKindError extends WeightedIndexError {
  constructor(kind: string, registered: string[]);
}
```

기존 error 계층(`WeightedIndexError` 상속) 그대로 따름.

## 소비 ^consumes

- `authorization-ontology-bitmap-pipeline` — `VersionedBitmap`의 mask 구조
- `authorization-ontology-resource-lifecycle` — 2-pass check의 Pass 1 address 계산
- `authorization-ontology-nested-audit-tracing` — 감사 entry의 kind·address 필드

## 위임 ^delegates

- **mixed-radix encoding 자체**: 기존 `WeightedIndex` — 각 variant의 sub-WI가 담당
- **bitmap 비트 연산**: 기존 `bitmask` 모듈
- **label ↔ index 매핑**: 필요 시 `LabelRegistry`를 각 variant별로 구성

## 방법 ^method

### 구현 순서

1. **Phase 1 — core API**
   - `src/vocab/union-index.ts` 신규
   - `DisjointUnionIndex` 클래스 + 기본 encode/decode/rangeOf
   - `UnionKindError` 정의
   - 단위 테스트: 3+ variants, offset 정합성, boundary 조건

2. **Phase 2 — range·pattern 연산**
   - `calcAddressRanges` kind-scoped 버전
   - cross-kind 병합은 `mergeRanges`로 위임 (새 API 아님)

3. **Phase 3 — bitmap 헬퍼**
   - `createMask` (전체 union 크기)
   - kind별 submask view (선택 — cost 측정 후 결정)

4. **Phase 4 — export + 문서**
   - `packages/weighted-index/src/vocab/index.ts` + `src/index.ts` 재export
   - README에 사용 예시
   - `docs/rdbms-equivalence/`에 sum type 섹션 추가 (선택)

### 테스트 전략

- **offset 정합성**: variants = `[{kind:A, shape:[3,3]}, {kind:B, shape:[2,5]}]`이면 range_A=[0,8], range_B=[9,18], totalSize=19
- **boundary 조건**: address=0, address=size-1, 각 variant의 경계
- **round-trip**: 모든 (kind, coord) → encode → decode 일치
- **kind 혼동 방지**: variant A의 address를 B kind으로 decode 시도 → IndexRangeError 또는 잘못된 kind 반환 (후자가 기본 동작, 명시)
- **variant append-only**: 기존 variant의 rangeOf가 새 variant 추가 후에도 동일
- **빈 variants**: 0개 variants 시 totalSize=0, 모든 encode 거절

### 성능 고려

- encode/decode는 variant 개수에 O(n) — 선형 탐색. 대부분 3-5개 kind이므로 무시할 수준.
- 많은 kind(>100) 가능성이 있으면 kind → offset 사전 빌드 후 O(1) lookup.
- bitmask 연산은 variant 수와 무관 — 전체 공간 위에서 일반 bitmask.

## 주의사항

- **cross-kind 좌표 없음**: `encode(kind="resource", coords=[...])`는 resource 공간 내 좌표만 표현. transaction 좌표와 섞일 수 없다 (의미적으로도 금지).
- **offset은 내부 구현 세부**: offset 값 자체를 외부에 노출하거나 저장하지 않는다. `rangeOf` 같은 API만 사용.
- **version bump 정책**: kind 추가는 minor, shape 확장은 major. variant **순서 변경은 금지** — 기존 address의 의미 전부 깨짐.
- **label 관리**: 각 variant가 독립 labels를 가지므로 `LabelRegistry`도 variant별로 별도 구성 가능. 통합 관리 원하면 상위 계층에서 조립.
- **empty kind 허용**: shape이 `[0]` 또는 빈 배열인 variant는 `Invalid shape` 에러. sum type의 변종은 최소 1개 entry 필요.

## 용어

- **Disjoint union addressing**: 서로 겹치지 않는 여러 sub-address range가 하나의 전역 address 공간을 형성하는 주소화 방식.
- **Variant**: union 내 하나의 kind 정의. shape·labels·kind 이름으로 구성.
- **Product type (기존)**: 모든 축이 곱셈으로 결합된 mixed-radix. `WeightedIndex`의 기본.
- **Sum type (신규)**: 여러 product type의 disjoint 합집합. `DisjointUnionIndex`.
