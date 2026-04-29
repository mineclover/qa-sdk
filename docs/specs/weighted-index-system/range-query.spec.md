---
def:
  tier: component
  id: range-query-spec
  address: def_document:v2:68787
  scope: feature
  aspect: func_def
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, performance, entry-point]
  links:
    - target: wi-api
      type: depends_on
    - target: wi-math
      type: depends_on
---

# Range Query 스펙

## 목적 ^purpose

`calcAddressRanges` — 부분 좌표 제약에서 주소 구간 계산.
디코딩 없이 1D 주소 공간을 직접 필터링한다.

## 구성 ^overview

- **핵심 개념**: n차원 좌표를 단일 정수로 인코딩한 WeightedIndex에서, 특정 차원을 고정하면 예측 가능한 정수 구간이 생성되어 DB `BETWEEN` 쿼리로 디코딩 없이 필터링 가능
- **CoordConstraint 문법**: `null`(와일드카드), `"n"`(단일), `"a-b"`(범위), `"a,b"`(이산 OR), `"a-b,c-d"`(범위 OR) 5종 표현식 지원
- **API 3종**: `calcAddressRanges`(제약 → 구간 목록), `mergeRanges`(합집합), `intersectRanges`(교집합)
- **차원 위치와 성능**: 외부 차원(낮은 index, 높은 weight)을 고정하면 연속 구간 1개, 내부 차원일수록 구간 수 폭발 — 자주 필터링하는 차원을 외부에 배치하는 것이 최적
- **OR/AND 조합 연산**: 합집합은 `mergeRanges`, 교집합은 `intersectRanges` 또는 단일 호출에 여러 dim 고정으로 수행
- **중첩 prefix 활용**: PrefixCodec과 결합하여 composite prefix를 디코딩 없이 순수 산술로 필터링하며, 비율은 `1/shape[dimIndex]`로 예측 가능
- **사용 예**: role/env 필터링, OR 조건, AND 조건, SQL `BETWEEN` 생성까지의 전체 코드 예시 포함

관련: [wi-system.md](wi-system.md), [index-meta-store-group.md](../index-meta-system/index-meta-store-group.md)


## 참조

패키지: `weighted-index`

## 상태

implemented

---

## 1. 개념

WeightedIndex가 n차원 좌표를 단일 정수로 인코딩하므로,
특정 차원 값을 고정하면 그에 해당하는 정수 구간이 예측 가능하다.

```
shape = [role(8), action(4), resource(16), env(4)]
capacity = 8 × 4 × 16 × 4 = 2048

address = (role-1)×256 + (action-1)×64 + (resource-1)×4 + (env-1)×1

role=3 고정 → (3-1)×256 = 512 ~ 767  (1개 연속 구간)
```

이 구간을 DB에서 `BETWEEN 512 AND 767`로 조회하면
디코딩 없이 role=3인 모든 레코드를 추출할 수 있다.

---

## 2. CoordConstraint 문법

```
null      → 와일드카드 (이 차원의 모든 값)
"n"       → 단일 좌표 (coord = n)
"a-b"     → 범위 (a ≤ coord ≤ b)
"a,b"     → 이산 OR (coord = a OR coord = b)
"a-b,c-d" → 범위 OR (a ≤ coord ≤ b OR c ≤ coord ≤ d)
```

**예시:**

```ts
calcAddressRanges([8,4,16,4], ["3",   null, null, null])   // role=3
calcAddressRanges([8,4,16,4], ["2-5", null, null, null])   // role=2..5
calcAddressRanges([8,4,16,4], ["1,3", null, null, null])   // role=1 OR 3
calcAddressRanges([8,4,16,4], ["3",   null, null, "1"])    // role=3 AND env=1
calcAddressRanges([8,4,16,4], ["1-3,6-8", null, null, null]) // role=1..3 OR 6..8
```

---

## 3. API

```ts
// 부분 좌표 제약 → 주소 구간 목록
calcAddressRanges(
  shape:       readonly number[],
  constraints: ReadonlyArray<CoordConstraint>,
): [number, number][]    // 정렬·병합된 [from, to] 구간 목록 (0-based, inclusive)

// 구간 병합 (합집합)
mergeRanges(ranges: [number, number][]): [number, number][]

// 구간 교집합 (AND 조건)
intersectRanges(
  a: readonly [number, number][],
  b: readonly [number, number][],
): [number, number][]
```

---

## 4. 차원 위치와 구간 연속성

차원이 외부(dim 0, 높은 weight)에 가까울수록 고정 시 구간이 연속적이다.

```
shape = [8, 4, 16, 4]
weights = [256, 64, 4, 1]

dim 0 (weight 256) 고정 → 1개 연속 구간,  크기 = 256
dim 1 (weight  64) 고정 → 8개 구간,        크기 = 64
dim 2 (weight   4) 고정 → 32개 구간,       크기 = 4
dim 3 (weight   1) 고정 → 512개 구간,      크기 = 1
```

**설계 원칙**: 자주 필터링하는 차원을 낮은 index(높은 weight)에 배치하면
DB range scan이 최소 구간으로 최적화된다.

---

## 5. 구간 조합 연산

### OR (합집합)

연속 OR → 단일 범위 문자열:
```ts
calcAddressRanges(shape, ["3-4", null, null, null])  // role=3 OR role=4
```

비연속 OR → 쉼표 구분 또는 두 번 계산 후 merge:
```ts
// 방법 A: 문자열 OR
calcAddressRanges(shape, ["1,3", null, null, null])

// 방법 B: 두 번 계산 후 merge
mergeRanges([
  ...calcAddressRanges(shape, ["1", null, null, null]),
  ...calcAddressRanges(shape, ["3", null, null, null]),
])
```

### AND (교집합)

```ts
// 방법 A: 단일 호출에 여러 dim 고정
calcAddressRanges(shape, ["3", null, null, "1"])  // role=3 AND env=1

// 방법 B: 각 조건을 따로 계산 후 intersect
intersectRanges(
  calcAddressRanges(shape, ["3", null, null, null]),
  calcAddressRanges(shape, [null, null, null, "1"]),
)
```

단일 호출(방법 A)이 더 효율적이다.
방법 B는 각 조건을 독립적으로 계산해야 할 때 유용하다.

---

## 6. 중첩 prefix 활용 (Graph-DB 효율)

`PrefixCodec`과 결합하면 중첩된 composite prefix를 디코딩 없이 필터링할 수 있다.

```
article shape = [content_type(4), perm(2048), lang(2)]

"role=editor인 article 조회":
  ① perm shape = [role(8), action(4), resource(16), env(4)]
     calcAddressRanges(permShape, ["3", null, null, null])
     → [[512, 767]]  ← perm 주소 범위

  ② 이 perm 범위를 article의 dim=1 (coord 513..768)로 전환
     calcAddressRanges(articleShape, [null, "513-768", null])
     → [[1024,1535], [5120,5631], [9216,9727], [13312,13823]]

  ③ DB: SELECT * WHERE article_index IN (위 4개 범위)
```

전체 과정에서 entry 조회 없이 순수 산술 연산만 사용한다.
필터링 비율은 `1 / shape[dimIndex]`로 예측 가능하다 (role=3이면 1/8).

---

## 7. 사용 예

```ts
import { calcAddressRanges, intersectRanges, mergeRanges } from "weighted-index";

const permShape = [8, 4, 16, 4]; // role, action, resource, env

// role=editor(3), 나머지 와일드카드
const byRole = calcAddressRanges(permShape, ["3", null, null, null]);
// → [[512, 767]]

// env=production(1), 나머지 와일드카드
const byEnv = calcAddressRanges(permShape, [null, null, null, "1"]);
// → [[0,0],[4,4],...] (512개)

// role=3 AND env=1 (단일 호출)
const both = calcAddressRanges(permShape, ["3", null, null, "1"]);
// → [[512,512],[516,516],...,[764,764]] (64개)

// role=3 AND env=1 (intersect 활용)
const bothAlt = intersectRanges(byRole, byEnv);
// → 동일한 결과

// role=1 OR role=3
const either = calcAddressRanges(permShape, ["1,3", null, null, null]);
// → [[0, 255], [512, 767]]

// DB range scan
const sql = both
  .map(([f, t]) => `address BETWEEN ${f} AND ${t}`)
  .join(" OR ");
// → "address BETWEEN 512 AND 512 OR address BETWEEN 516 AND 516 OR ..."
```
