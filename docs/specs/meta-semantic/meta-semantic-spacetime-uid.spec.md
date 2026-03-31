---
def:
  id: meta-semantic-spacetime-uid
  level: module
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-ir
      type: depends_on
    - target: meta-semantic-extraction
      type: depends_on
    - target: coord-foundation
      type: depends_on
---

# Spacetime UID — 분기 경로 기반 시공간 주소 체계

## 목적 ^purpose

검증 가능한 실행 단위(함수) 내의 **분기 경로**를 좌표화하고,
각 경로의 실행 이력에 **시간 축(tx_seq)**을 결합하여
"어떤 경로가 언제 실행되었는가"를 단일 주소로 추적하는 인코딩 체계.

전체 변수의 전곱(N×M)이 아니라 **이벤트별 도달 가능한 경우의 수만 수집**하여
주소 공간 낭비를 방지한다.

## 정의 ^defines

- 분기 경로 모델 (전곱 vs 경로 합산의 차이)
- 경로별 WeightedIndex 인코딩 전략
- 시간 축 결합 (경로 주소 × tx_seq)
- 경로 그래프 → 주소 범위 매핑
- 계보 쿼리 패턴

## 소비 ^consumes

- `WeightedIndex` (weighted-index/math) — 경로별 좌표 압축
- `LabelRegistry` (weighted-index/vocab) — 분기 라벨 인덱싱 (append-only)
- `SemanticAddress` (weighted-index/protocol) — 버전 태깅 + 직렬화
- `calcAddressRanges` (weighted-index/math) — 주소 범위 계산
- `BranchPoint`, `ExecutionUnit` (meta-semantic-extraction) — 분기 그래프

## 구성 ^overview

3가지 핵심 구성:

1. **분기 경로 좌표 모델**: 경로별 WeightedIndex → 주소 범위 연접
2. **시간 축 결합**: 경로 주소 + tx_seq → 시공간 UID
3. **쿼리 패턴**: 경로별 실행 이력, 분기 통계, 궤적 추적

---

## 1. 분기 경로 좌표 모델

### 핵심: 전곱이 아닌 경로 합산

```
❌ 전곱:
   orderType(3) × paymentMethod(4) × shippingOption(2) = 24
   → 도달 불가능한 조합 포함 (express 주문인데 sameDay 배송만 해당 등)

✓ 경로 합산:
   orderType(3) → paymentMethod(4):  3 × 4 = 12 경로
   orderType(3) → shippingOption(2): 3 × 2 = 6 경로
   총: 12 + 6 = 18 경로 (도달 가능한 것만)
```

### 경로별 WeightedIndex 인스턴스

각 독립 경로를 별도 WeightedIndex로 인코딩하고, 주소 범위를 연접한다:

```typescript
interface PathSegment {
  /** 경로 식별자 */
  pathId: string;
  /** 이 경로의 분기점 체인 */
  branchChain: BranchPoint[];
  /** WeightedIndex shape — 체인의 각 분기 수 */
  shape: number[];
  /** 전체 주소 공간에서의 시작 오프셋 */
  addressOffset: number;
  /** WeightedIndex 인스턴스 */
  index: WeightedIndex;
}

// 예시: processOrder 함수
const segments: PathSegment[] = [
  {
    pathId: 'processOrder:type→payment',
    branchChain: [orderTypeBP, paymentMethodBP],
    shape: [3, 4],           // 3종 주문유형 × 4종 결제방법
    addressOffset: 0,        // 시작: 0
    index: new WeightedIndex([3, 4], ['orderType', 'paymentMethod']),
    // 주소 범위: [0, 11] (12개)
  },
  {
    pathId: 'processOrder:type→shipping',
    branchChain: [orderTypeBP, shippingOptionBP],
    shape: [3, 2],           // 3종 주문유형 × 2종 배송옵션
    addressOffset: 12,       // 시작: 이전 세그먼트 끝 + 1
    index: new WeightedIndex([3, 2], ['orderType', 'shippingOption']),
    // 주소 범위: [12, 17] (6개)
  },
];
// 전체: 18개 주소 — 도달 가능한 경로만
```

### 주소 범위 연접 규칙

```
segment[0]: offset = 0,                    range = [0, totalSize₀ - 1]
segment[1]: offset = totalSize₀,           range = [totalSize₀, totalSize₀ + totalSize₁ - 1]
segment[n]: offset = Σ totalSize₀..ₙ₋₁,    range = [offset, offset + totalSizeₙ - 1]
```

### 경로 내 좌표 → 전역 주소 변환

```typescript
function encodeGlobal(segment: PathSegment, coord: number[]): number {
  return segment.addressOffset + segment.index.encode(coord);
}

function decodeGlobal(segments: PathSegment[], globalAddr: number): {
  segment: PathSegment;
  coord: number[];
} {
  for (const seg of segments) {
    const localMax = seg.addressOffset + seg.index.totalSize;
    if (globalAddr < localMax) {
      const localAddr = globalAddr - seg.addressOffset;
      return { segment: seg, coord: seg.index.decode(localAddr) };
    }
  }
  throw new Error('주소 범위 초과');
}
```

---

## 2. 시간 축 결합

### 구조: 경로 주소 × tx_seq

경로 주소가 "어떤 분기 조합인가"를 표현하고,
tx_seq가 "그 경로가 몇 번째 실행되었는가"를 표현한다.

```
Spacetime UID = (functionId, pathAddress, txSeq)

직렬화: intent:v1:{functionIndex}:{pathAddress}:{txSeq}
```

### LabelRegistry 구성

```typescript
const intentLabels = createLabelRegistry({
  // 실행 단위 (Semantic Folding으로 식별된 함수들)
  function: [
    {
      version: 'v1',
      ids: ['processOrder', 'processPayment', 'generateReceipt']
    }
  ],
  // 변이 유형
  mutation: [
    {
      version: 'v1',
      ids: ['executed', 'failed', 'retried', 'skipped']
    }
  ]
});
```

### 시공간 주소 할당 흐름

```
1. Semantic Folding → 함수 식별: processOrder (functionIndex: 1)
2. LLM 분기 추출 → 경로 그래프:
   path1: orderType(3) × paymentMethod(4) = [0..11]
   path2: orderType(3) × shippingOption(2) = [12..17]
3. 실행 시:
   processOrder(normal, card) → segment[0].encode([1, 1]) → pathAddr: 0
   txSeq: 42번째 실행
4. Spacetime UID:
   intent:v1:1:0:42
   → "processOrder 함수의 0번 경로(normal×card)가 42번째 실행됨"
```

---

## 3. 계보 추적 패턴

### 3.1 특정 경로의 실행 이력

```typescript
// "processOrder에서 normal×card 경로의 모든 실행"
const pathAddr = segments[0].index.encode([1, 1]); // normal=1, card=1 → 0
// txSeq 와일드카드로 전체 이력 조회
// → intent:v1:1:0:* (모든 tx_seq)
```

### 3.2 특정 분기의 모든 경로

```typescript
// "express 주문(orderType=2)의 모든 실행 경로"
// segment[0]: orderType=2 → [4, 5, 6, 7] (paymentMethod 4종)
// segment[1]: orderType=2 → [14, 15]     (shippingOption 2종)
// 총 6개 주소에서 모든 tx_seq
```

### 3.3 함수 단위 집계

```typescript
// "processOrder의 경로별 실행 빈도"
for (const seg of processOrderSegments) {
  for (let addr = 0; addr < seg.index.totalSize; addr++) {
    const coord = seg.index.decode(addr);
    const txCount = getExecutionCount(functionIndex, seg.addressOffset + addr);
    // coord → 분기 라벨, txCount → 실행 횟수
  }
}
// 결과: { "normal×card": 142, "express×bank": 3, ... }
```

### 3.4 시간 순회 궤적

```
processOrder 실행 궤적:
  tx:1  path:0  (normal, card)     ·
  tx:2  path:4  (normal, bank)       ·
  tx:3  path:0  (normal, card)     ·
  tx:4  path:12 (normal, standard)               ·
  tx:5  path:8  (express, card)          ·

→ 시간 축에서 경로 변화를 추적
→ "express 주문이 최근 증가" 등의 패턴 발견 가능
```

---

## 4. 직렬화 프로토콜

### 주소 형식

```
colon:   intent:v1:1:0:42    (function:path:tx)
compact: intent-v1-1-0-42
```

### 범위 쿼리 형식

```
특정 함수의 모든 실행:    intent:v1:1:*:*
특정 경로의 모든 실행:    intent:v1:1:0:*
특정 시간대의 모든 실행:  intent:v1:*:*:42-100
```

---

## 5. definition-catalog 좌표와의 관계

### 좌표 동형

```
definition-catalog:  scope × aspect × depth × seq    → def_document:v2:N
meta-semantic:       function × path × tx_seq         → intent:v1:F:P:T

같은 WeightedIndex 수학을 경로 단위로 적용.
같은 SemanticAddress 직렬화.
다른 차원 구성, 다른 주소 공간 전략.
```

### 교차 참조

```
def_document:v2:342162 (문서: payment-api-spec)
  ↕ @def.doc 주석
intent:v1:1:0:42 (코드: processOrder, normal×card, 42번째 실행)

문서 좌표 + 코드 경로 좌표 = 양방향 추적
```

---

## 6. 불변성 보장

### 주소 불변 규칙

| 상황 | 주소 변경 여부 | 이유 |
|------|--------------|------|
| 같은 경로 재실행 | 새 tx_seq 할당 | 실행 이력 보존 |
| 새 분기점 추가 | 새 segment 추가 (기존 불변) | 기존 경로 주소 보존 |
| 분기 제거 | 기존 주소 유지 (비활성 표시) | 과거 참조 보존 |
| LabelRegistry 버전 추가 | 기존 인덱스 불변 | append-only |

### 분기점 추가 시

```
기존:
  seg[0]: orderType(3) × paymentMethod(4)  → [0, 11]
  seg[1]: orderType(3) × shippingOption(2) → [12, 17]

분기 추가 (insuranceOption 2종):
  seg[2]: orderType(3) × insuranceOption(2) → [18, 23]  ← 새 세그먼트
  기존 seg[0], seg[1]의 주소는 불변
```

---

## 7. 성능 특성

| 연산 | 복잡도 | 비고 |
|------|--------|------|
| encode (경로 내) | O(d) | d=경로 깊이 |
| decode (전역 → 경로+좌표) | O(s) | s=세그먼트 수 (이진탐색으로 O(log s)) |
| 경로 멤버십 판정 | O(1) | 주소 범위 비교 |
| 특정 경로 실행 이력 | O(1) + O(k) | k=결과 수 |
| 분기별 집계 | O(totalPaths) | 전체 경로 순회 |

### 주소 공간 효율

```
100개 변수, 각 평균 3개 분기:
  전곱: 3^100 ≈ 5 × 10^47 (사실상 무한)
  경로: 각 함수별 도달 가능 경로만 수집
    함수당 평균 3개 분기점, 평균 깊이 2:
    3 × 3 + 3 × 3 = 18 경로 / 함수
    50개 함수 × 18 = 900 경로 (관리 가능)
```
