---
def:
  id: wi-capacity-planning
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [performance]
  links:
    - target: wi-pack-format-def
      type: depends_on
    - target: wi-semantic-address
      type: depends_on
---
# Capacity 계획

## 목적 ^purpose

fitShape(shape 용량 맞춤), fitLayout(shape + layout 통합), planCapacity(growth-aware capacity 제안). 축 추가/확장 시 최적 capacity를 자동 계산한다.

## 구성 ^overview

Capacity Planning은 3개 함수로 구성되며, 저수준에서 고수준으로 조합된다.

- **fitShape** — shape product를 maxProduct 이하로 비례 축소
- **fitLayout** — fitShape + planLayout 통합 (포맷 예산 자동 계산)
- **planCapacity** — 차원별 현재/성장 예측 기반 최적 capacity 추천

## fitShape — 비례 축소

shape의 product가 maxProduct를 초과할 때, 비례적으로 축소하여 맞춘다.

```typescript
fitShape({
  shape: [99999, 999, 99, 99],
  maxProduct: 16 ** 7,   // ≈ 268M
  min: 2,                // 차원별 최솟값
  fixed: new Set([0]),   // 0번 차원 고정
})
```

### 알고리즘

1. **비례 스케일링**: `ratio = (maxProduct / currentProduct) ^ (1 / freeDims)`
2. **Floor + min 보장**: 각 차원을 floor 후 min 이상으로 보정
3. **Greedy fill**: product ≤ maxProduct 범위에서 원래 값에 가깝게 차원별 증가 (원본 크기 큰 순)

반환값이 `null`이면 이미 맞거나 (조정 불필요) 맞출 수 없음.

### 결과

```typescript
interface FitShapeResult {
  shape: number[];           // 조정된 shape
  product: number;           // 결과 곱
  utilization: number;       // product / maxProduct (0~1)
  boundaries: HexBoundary[]; // 각 차원의 hex 경계 분석
}
```

## fitLayout — 포맷 통합

fitShape + planLayout을 결합. 포맷의 left fields(schema, version)를 제외한 index 예산을 자동 계산.

```typescript
fitLayout({
  shape: [1000, 500, 100],
  left: [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: "uuid",         // BuiltinFormatName | PackFormat | number
  min: [10, 10, 5],
  fixed: new Set([2]),
})
```

capacity 인자는 유연하게 해석된다:
- `"uuid"`, `"int64"` — 내장 포맷 이름
- `PackFormat` 객체 — 커스텀 포맷
- `number` — hex chars 수 (익명 포맷 생성)

`null` 반환 조건: left fields가 전체 예산을 소진하거나, fitShape로 축소 불가능한 경우.

## planCapacity — 성장 기반 추천

차원별 현재 entry 수와 성장 예측을 받아 최적 capacity를 추천한다.

```typescript
planCapacity({
  dims: [
    { name: "role",     current: 5,  growth: 3 },   // 5+3=8  → nextPow2 → 8
    { name: "action",   current: 8,  growth: 0 },   // 8+0=8  → nextPow2 → 8
    { name: "resource", current: 3,  growth: 10 },  // 3+10=13 → nextPow2 → 16
  ],
  left: [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: "uuid",
  shardChars: 0,
})
```

### 알고리즘

1. 각 차원: `current + growth → nextPow2` 정렬
2. 포맷 예산 초과 시 `fitShape`로 축소 (current를 min으로 보호)
3. `growth/current > 1.0`인 dim이 있으면 샤딩 권장

### 2의 거듭제곱 정렬

2의 거듭제곱은 hex 자릿수 경계와 자연스럽게 정렬된다:
- 16=0x10 (1자리), 256=0x100 (2자리), 4096=0x1000 (3자리)

`growth` 미지정 시 `current`와 동일 (= 2배 headroom이 기본값).

### 결과

```typescript
interface CapacityPlanResult {
  dims: CapacityRecommendation[];  // 차원별 추천
  shape: number[];                  // 권장 capacity 배열
  product: number;                  // shape 곱
  fits: boolean;                    // 포맷에 적합한지
  indexBudget: number;              // index hex 자릿수
  utilization: number;              // product / maxProduct
  shardingAdvised: boolean;         // 변동성 높은 dim 존재 시 true
  plan: LayoutPlan;                 // 레이아웃 계획
  format: PackFormat;               // 사용된 포맷
}

interface CapacityRecommendation {
  name: string;
  current: number;
  growth: number;
  recommended: number;   // nextPow2(current + growth)
  hexChars: number;      // recommended의 hex 자릿수
  headroom: number;      // (recommended - current) / recommended
}
```

## 의존 관계

```
planCapacity
  ├── fitShape (비례 축소)
  │     └── hexBoundary (hex 경계 분석)
  └── planLayout (필드 배치)
        └── charsForMax (최소 hex 자릿수)
```

## 소스 위치

- `packages/weighted-index/src/protocol/capacity-planner.ts`
