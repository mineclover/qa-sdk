---
def:
  id: axis-projection
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [optimization, decode, partial]
  links:
    - target: wi-math
      type: refines
---

# Axis Projection — 부분 decode 최적화

## 목적 ^purpose

mixed-radix weighted-index에서 전체 decode O(d) 대신 요청한 k개 차원만 O(k)로 추출한다.

## 수학적 기반 ^defines

i번째 차원 독립 추출 공식:

```
coord_i = floor(address / stride[i]) % shape[i] + 1
```

`stride[i] = Π_{j>i} shape[j]` (calcWeights로 사전 계산). 이 공식으로 **임의 차원을 독립 추출** — 순차 modulo-division 루프 불필요.

## API ^method

### Layer 1: 순수 함수 (calc.ts)

```typescript
partialDecode(
  address: number,
  shape: readonly number[],
  strides: readonly number[],
  dimIndices: readonly number[],
): Record<number, number>
```

dimIndices에 해당하는 차원만 추출. 결과: `{ dimIndex: coord(1-based) }`.

정의: `weighted-index/src/math/calc.ts`

### Layer 2: 인스턴스 메서드 (WeightedIndex)

```typescript
extractDims(address: number, labels: string[]): Record<string, number>
```

label → dimIndex 변환 후 동일 공식 적용. 미존재 label → CoordError.

정의: `weighted-index/src/math/weighted-index.ts`

### Layer 3: catalog runtime (runtime.ts)

```typescript
decodePrefixPartial(
  catalog: Catalog, prefixId: string, version: string,
  address: number, labels: string[],
): Record<string, DecodedPosition>
```

요청한 labels만 부분 decode + axis entry/prefix_ref 해석. table_ref 차원은 자동 제외.

정의: `core/src/catalog/runtime.ts`

### Layer 4: Aggregator

```typescript
// InMemoryAggregator constructor option
partialDecodeFn?: (key: string, axes: string[]) => Record<string, string> | null
```

projectAxis 내부에서 partialDecodeFn이 있으면 사용, 없으면 기존 decodeFn fallback.

정의: `store/src/adapters/memory/aggregator.adapter.ts`

## 성능 ^defines

| 시나리오 | Full decode | Partial decode |
|----------|:-----------:|:--------------:|
| d=4, k=1 | 4 mod/div | 1 div + 1 mod |
| d=10, k=2 | 10 mod/div | 2 div + 2 mod |
| d=16, k=3 | 16 mod/div | 3 div + 3 mod |

projectAxis에서 수만 건 반복 시 d/k 비율만큼 개선.

## 파일 배치

| 파일 | 역할 |
|------|------|
| `weighted-index/src/math/calc.ts` | partialDecode 순수 함수 |
| `weighted-index/src/math/weighted-index.ts` | extractDims 인스턴스 메서드 |
| `core/src/catalog/runtime.ts` | decodePrefixPartial |
| `store/src/adapters/memory/aggregator.adapter.ts` | partialDecodeFn 옵션 |
