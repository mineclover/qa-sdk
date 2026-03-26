---
def:
  id: wi-math
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: coord-foundation
      type: depends_on
---
# Weighted-Index 핵심 수학

## 목적 ^purpose

mixed-radix 기반 좌표 인코딩의 수학적 기반. shape(차원별 크기), strides(가중치), encode(좌표→정수), decode(정수→좌표) 공식을 정의한다.

## 구성 ^overview

핵심 수학 레이어는 4개 모듈로 구성된다.

- **calc.ts** — 순수 함수: `calcWeights`, `calcAddressRanges`, range 대수(merge/intersect/subtract/complement)
- **weighted-index.ts** — `WeightedIndex` 클래스: Number 기반 encode/decode + Batch API
- **weighted-index-big.ts** — `WeightedIndexBig` 클래스: BigInt 기반 (2^53 초과 shape product)
- **calc-big.ts** — BigInt 버전 순수 함수: `calcWeightsBig`, `calcAddressRangesBig`
- **bitmask.ts** — 비트 연산: createMask/setBit/hasBit + 마스크 대수(AND/OR/overlap)
- **pattern-lattice.ts** — CoordConstraint 패턴 간 포함 관계·lattice 연산(meet/join)

## 인코딩 공식

닫힌 패턴(closed pattern)의 좌표를 1D 정수(주소)로 압축하는 가중진법(weighted positional notation).

```
shape[i]    = i번째 차원의 크기 (가능한 값의 수, ≥ 1)
strides[i]  = Π_{j > i} shape[j]    (마지막 차원은 항상 1)
size        = Π shape[i]            (총 주소 공간 크기)

encode: address = Σ (coord[i] - 1) × strides[i]
decode: coord[i] = ⌊address / strides[i]⌋ % shape[i] + 1
```

좌표는 1-based (`coord[i] ∈ [1, shape[i]]`), 주소는 0-based (`address ∈ [0, size-1]`).
같은 좌표 → 같은 정수, 다른 좌표 → 다른 정수 (전단사 bijection).

## Range 대수 — 부분 질의 최적화

`calcAddressRanges(shape, constraints)` 는 CoordConstraint 배열(null=와일드카드, `"2-5"`, `"1,3,7-9"`)에서 유효한 주소 구간 `[from, to][]`을 계산한다.

- 외부 dim 고정(높은 stride) → 적은 수의 큰 구간
- 내부 dim 고정(낮은 stride) → 많은 수의 작은 구간
- 이후 모든 차원이 와일드카드이면 하나의 연속 블록으로 최적화

Range 결과에 대한 집합 연산:

| 함수 | 연산 | 용도 |
|------|------|------|
| `mergeRanges` | 합집합 | 인접/겹치는 구간 병합 |
| `intersectRanges` | 교집합 | 두 조건의 AND 결합 |
| `subtractRanges` | 차집합 | 제외 조건 적용 |
| `complementRanges` | 여집합 | 전체 공간에서 특정 구간 제거 |
| `containsAddress` | 포함 검사 | O(log n) 이진 탐색 |

## Bitmask — O(1) 권한 검사

`WeightedIndex.encode()` 결과를 비트 위치로 사용하여 Uint8Array 마스크에 권한을 저장한다. 640개 슬롯 = 80바이트.

```typescript
const mask = createMask(wi.size);
setBit(mask, wi.encode([role, action, resource, env]));
hasBit(mask, candidateId);  // O(1) 검사
```

마스크 대수: `maskAnd`(교집합), `maskOr`(합집합), `masksOverlap`(공통 비트 존재 여부).

## BigInt 모드

`WeightedIndexBig`은 `shape product > 2^53`일 때 사용. 동일 알고리즘이지만 `bigint` 타입. Number 기반 대비 5~20x 느리므로 필요한 경우에만 사용.

## 소스 위치

- `packages/weighted-index/src/math/calc.ts`
- `packages/weighted-index/src/math/weighted-index.ts`
- `packages/weighted-index/src/math/weighted-index-big.ts`
- `packages/weighted-index/src/math/calc-big.ts`
- `packages/weighted-index/src/math/bitmask.ts`
- `packages/weighted-index/src/math/pattern-lattice.ts`
- `packages/weighted-index/src/math/types.ts`
