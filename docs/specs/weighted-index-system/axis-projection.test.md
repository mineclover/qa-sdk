---
def:
  id: axis-projection-test
  level: leaf
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [testing, optimization]
  links:
    - target: axis-projection
      type: traces_to
  source: packages/weighted-index/src/math/calc.test.ts
---

# Axis Projection — 테스트 시나리오

## 목적 ^purpose

partialDecode의 정확성을 full decode 동치성으로 증명하고, 적용 범위별 동작을 검증한다.

## 검증 항목

### partialDecode (calc.ts) — 7 cases

| # | 시나리오 | 검증 |
|---|---------|------|
| 1 | 전체 차원 추출 | full decode 결과와 동일 |
| 2 | 단일 차원 (dim 0) | 첫 번째 차원만 정확히 추출 |
| 3 | 단일 차원 (마지막 dim) | 마지막 차원만 정확히 추출 |
| 4 | 2개 차원 (비연속) | dim 1, 3만 추출 |
| 5 | address 0 | 모든 차원 1 |
| 6 | 빈 dimIndices | 빈 객체 반환 |
| 7 | 전수 검증 | 소형 shape [3,4,2] 전체 주소 공간 — full decode와 동치 |

파일: `weighted-index/src/math/calc.test.ts`

### WeightedIndex.extractDims — 4 cases

| # | 시나리오 | 검증 |
|---|---------|------|
| 1 | label 기반 부분 추출 | env, svc만 요청 → 정확한 값 |
| 2 | 전체 label | decodeToRecord()와 동일 결과 |
| 3 | 단일 label | ns만 요청 → 정확한 값 |
| 4 | 미존재 label | CoordError 발생 |

파일: `weighted-index/src/math/weighted-index.test.ts`

### Aggregator.projectAxis partialDecodeFn — 1 case

| # | 시나리오 | 검증 |
|---|---------|------|
| 1 | partialDecodeFn 주입 시 결과 동일 | fullDecode vs partialDecode 주입 → projectAxis 결과 동치 |

파일: `store/src/adapters/memory/aggregator.adapter.test.ts`

## 동치성 증명 구조

```
∀ address ∈ [0, size), ∀ i ∈ [0, d):
  partialDecode(address, shape, strides, [i])[i] === decode(address)[i]
```

테스트 7번(전수 검증)이 소형 shape에서 이를 전수 확인. 대형 shape는 샘플링으로 검증.

## 테스트 현황

| 계층 | 파일 | 케이스 |
|------|------|:---:|
| calc.ts | calc.test.ts | 7 |
| WeightedIndex | weighted-index.test.ts | 4 |
| Aggregator | aggregator.adapter.test.ts | 1 |
| **합계** | | **12** |

## 향후 통합 테스트 (활용처 적용 시)

| 활용처 | 검증 항목 |
|--------|----------|
| aggregateUsageData | axis-only partial decode → 기존 full decode 결과와 EntryUsage 동치 |
| analyzeCollectionHealth | orphan 감지 결과가 full decode 기반과 동일 |
| projectAxis + catalog | catalog 기반 partialDecodeFn 주입 → 기존 결과와 동치 |
