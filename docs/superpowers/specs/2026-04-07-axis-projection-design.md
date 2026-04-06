# I-6: Axis Projection 최적화 설계

> 2026-04-07. 부분 decode (특정 축만 추출) — shift/modulo로 단축.

## 목적

mixed-radix weighted-index에서 전체 decode O(d) 대신 요청한 k개 축만 추출하는 O(k) 부분 decode를 구현한다. Aggregator.projectAxis, catalog runtime, query-service matchRanges에 적용.

## 수학적 원리

mixed-radix encoding: `address = Σ(coord_i - 1) × stride[i]`

**i번째 차원 독립 추출**:
```
coord_i = floor(address / stride[i]) % shape[i] + 1
```

full decode는 이를 역순 modulo-division 루프 O(d)로 수행. 하지만 위 공식으로 **임의 차원을 독립 추출** 가능 → O(k).

## 변경 범위

### Layer 1: weighted-index 코어

**파일**: `weighted-index/src/math/calc.ts`

```typescript
/**
 * 특정 차원만 추출하는 부분 decode.
 * coord_i = floor(address / stride[i]) % shape[i] + 1
 */
export function partialDecode(
  address: number,
  shape: readonly number[],
  strides: readonly number[],
  dimIndices: readonly number[],
): Record<number, number>
```

**파일**: `weighted-index/src/math/weighted-index.ts`

WeightedIndex 클래스에 인스턴스 메서드 추가:

```typescript
/** 요청한 labels에 해당하는 차원만 부분 decode */
extractDims(address: number, labels: string[]): Record<string, number>
```

`weighted-index/src/index.ts`에 `partialDecode` export 추가.

### Layer 2: catalog runtime

**파일**: `core/src/catalog/runtime.ts`

```typescript
/**
 * prefix 1D 주소에서 요청한 labels만 부분 decode.
 * 전체 decodePrefix() 대비 O(k) — k = |labels|.
 */
export function decodePrefixPartial(
  catalog: Catalog, prefixId: string, version: string,
  address: number, labels: string[],
): Record<string, DecodedPosition>
```

### Layer 3: Aggregator.projectAxis

**파일**: `core/src/ports/aggregator.port.ts` — 인터페이스 변경 없음

**파일**: `store/src/adapters/memory/aggregator.adapter.ts`

현재: `decodeFn(key)` → full decode → 축 추출
최적화: `partialDecodeFn?(key, axes)` 옵션 주입. 있으면 사용, 없으면 기존 decodeFn fallback.

### Layer 4: query-service matchRanges pre-filter

**파일**: `index-meta/src/relational-engine.ts` (또는 관련)

`calcAddressRanges` 호출 전에 partialDecode로 고정 차원 값을 사전 검증하여 불필요한 range 계산 skip.

## 테스트

| 대상 | 파일 | 케이스 |
|------|------|------|
| partialDecode | `weighted-index/src/math/calc.test.ts` | full decode 동치성, 1축/2축/전체축 추출, 경계값 |
| WeightedIndex.extractDims | `weighted-index/src/math/weighted-index.test.ts` | label 기반 부분 추출, 미존재 label 에러 |
| decodePrefixPartial | `core/src/catalog/runtime.test.ts` | decodePrefix 부분 결과 동치성 |
| Aggregator projectAxis | `store/src/adapters/memory/aggregator.adapter.test.ts` | 기존 결과와 동일성 |

## 성능 기대

| 시나리오 | Full decode | Partial decode |
|----------|:-----------:|:--------------:|
| d=4, k=1 | 4 mod/div | 1 div + 1 mod |
| d=10, k=2 | 10 mod/div | 2 div + 2 mod |
| d=16, k=3 | 16 mod/div | 3 div + 3 mod |

projectAxis에서 수만 건 반복 시 d/k 비율만큼 개선.

## 산출물 제약

| 산출물 | 경로 | 설명 |
|--------|------|------|
| spec.md | `docs/specs/weighted-index-system/axis-projection.spec.md` | partialDecode 인터페이스, 수학적 기반, 적용 범위 |
| test.md | `docs/specs/weighted-index-system/axis-projection.test.md` | 테스트 시나리오, 검증 항목, 동치성 증명 구조 |

구현 완료 후 반드시 spec.md + test.md를 작성하여 코드와 1:1 대응시킨다.
