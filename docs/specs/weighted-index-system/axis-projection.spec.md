---
def:
  id: axis-projection
  tier: component
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

## 수학적 기반 ^defines:math

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

## 성능 ^defines:performance

| 시나리오 | Full decode | Partial decode |
|----------|:-----------:|:--------------:|
| d=4, k=1 | 4 mod/div | 1 div + 1 mod |
| d=10, k=2 | 10 mod/div | 2 div + 2 mod |
| d=16, k=3 | 16 mod/div | 3 div + 3 mod |

projectAxis에서 수만 건 반복 시 d/k 비율만큼 개선.

## 주 활용처 ^consumes

| # | 활용처 | 파일 | 현재 | 최적화 | 효과 |
|---|--------|------|------|--------|------|
| UC-1 | **Usage Aggregation** | `convergence/usage-aggregator.ts:111` | `decodePrefixAsResult()` 전체 decode (per-record 루프) | axis-only labels로 `decodePrefixPartial()` 호출 | **핫패스 ~2x** — axis 차원만 사용하므로 prefix_ref/table_ref decode 생략 |
| UC-2 | **Collection Health 검증** | `convergence/usage-aggregator.ts:270` | `decodePrefix()` 전체 decode (성공/실패만 확인) | 빈 labels로 호출 또는 경량 validation 함수 | decode 루프 완전 생략 |
| UC-3 | **Aggregator.projectAxis** | `store/aggregator.adapter.ts:95` | `partialDecodeFn` 옵션 (이미 구현) | 소비처에서 catalog 기반 partialDecodeFn 주입 | axes 수만큼만 decode |
| UC-4 | **decode-service /decode/batch** | `decode-service/routes/decode.ts:86` | 전체 decode per input | 향후 `fields` 파라미터 추가 시 적용 | 클라이언트 opt-in |

### 적용 우선순위

1. **UC-1 (aggregateUsageData)**: 프로덕션 convergence 파이프라인의 실 핫패스. prefix당 axis-only labels 사전 추출 → decodePrefixPartial 호출로 교체.
2. **UC-2 (analyzeCollectionHealth)**: 검증 전용 경로. decode 성공 여부만 확인하므로 최소 비용.
3. **UC-3 (projectAxis)**: 인프라 준비 완료. 소비처에서 partialDecodeFn을 catalog 기반으로 주입하면 즉시 활성화.
4. **UC-4 (batch decode)**: 클라이언트 API 변경 필요. 향후 확장.

## 파일 배치

| 파일 | 역할 |
|------|------|
| `weighted-index/src/math/calc.ts` | partialDecode 순수 함수 |
| `weighted-index/src/math/weighted-index.ts` | extractDims 인스턴스 메서드 |
| `core/src/catalog/runtime.ts` | decodePrefixPartial |
| `store/src/adapters/memory/aggregator.adapter.ts` | partialDecodeFn 옵션 |
