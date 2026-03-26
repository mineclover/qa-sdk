---
def:
  id: dim-ops-cross-select
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: table-dimref-types
      type: depends_on
    - target: wi-api
      type: depends_on
---

# 축 교차 선택

## 목적 ^purpose

N개 축에서 특정 차원만 선택하여 부분 좌표를 구성하는 교차 선택 연산.

여러 축의 값을 동시에 지정하여 해당하는 주소만 골라내는 연산. 3개 레이어가 추상화 수준별로 제공된다.

## 구성 ^overview

- **BitIndex**: 패킹된 정수에서 shift+mask로 O(1) 단일 축 값 추출
- **BitMaskSet**: grant된 주소 집합에서 다축 AND 조건 필터링 및 고유값 조회
- **ScopedEngine**: env/region 등 외부 차원별 독립 PermissionSet 관리 + 교집합/합집합
- **queryGranted**: CoordConstraint 문법으로 범위 조건을 걸어 grant된 주소만 반환
- **추상화 계층**: BitIndex(비트 연산) → BitMaskSet(집합 필터) → ScopedEngine(스코프 관리) 순으로 상위
- **선택 기준**: 단일 축 추출, 다축 AND 필터, 스코프 교차, 범위 패턴 질의 등 상황별 도구 구분

---

## 1. BitIndex — O(1) 단일 축 추출

소스: `packages/bit-index/src/bit-index.ts`

패킹된 정수에서 특정 차원의 값을 shift+mask로 즉시 추출한다.

```ts
import { BitIndex } from "bit-index";

const bi = BitIndex.fromShape([32, 32, 32, 32]); // env × region × svc × ns

const packed = bi.pack([2, 0, 3, 1]);
bi.extractDim(packed, 0);              // → 2 (env)
bi.extractDimByLabel(packed, "region"); // → 0
bi.extractDims(packed, [0, 2]);        // → [2, 3] (env, svc)
```

특징:
- WeightedIndex의 `decode`가 O(d) 나눗셈인 반면, BitIndex는 O(1) shift+mask
- 단일 차원만 필요할 때 전체 decode 없이 추출 가능

---

## 2. BitMaskSet — 다축 AND 필터

소스: `packages/bit-index/src/bit-mask-set.ts`

grant된 주소 집합에서 여러 축 조건을 동시에 만족하는 것만 필터링한다.

```ts
import { BitMaskSet } from "bit-index";

// PermissionSet이나 PermissionView에서 변환된 BitMaskSet
const perms: BitMaskSet = codec.toBitMaskSet(mask);

// 단일 축 필터
perms.filterByLabel("role", 2);          // role=2인 모든 권한

// 다축 AND 필터 — "role=admin AND action=read"
perms.filterByLabels({ role: 0, action: 0 });

// 특정 축의 고유값 목록
perms.distinctByLabel("region");         // → [0, 1] (asia, usa)
```

핵심 API:

| API | 설명 |
|---|---|
| `filterByDim(dimIndex, value)` | 단일 축 = 값 필터 |
| `filterByLabel(label, value)` | 라벨 이름 기반 단일 축 필터 |
| `filterByLabels(conditions)` | 여러 축 동시 AND 필터 |
| `distinctDim(dimIndex)` | grant된 주소에서 해당 축의 고유값 목록 |
| `distinctByLabel(label)` | 라벨 이름 기반 고유값 |

---

## 3. ScopedEngine — 스코프 교차/합집합

소스: `packages/permission-engine/src/scoped-engine.ts`

외부 차원(env, region, device 등)별로 독립 PermissionSet을 유지하고, 여러 스코프를 교차하거나 합친다.

```ts
import { ScopedEngine } from "permission-engine";

const engine = new ScopedEngine(features, roles);

// 스코프별 독립 권한 부여
engine.scope("prod:asia").grant("orders", "admin");
engine.scope("prod:usa").grant("orders", "admin");
engine.scope("dev:asia").grant("orders", "developer");

// 교집합 — "prod:asia AND prod:usa 양쪽 다 있는 권한은?"
const shared = engine.intersectScopes(["prod:asia", "prod:usa"]);
shared.has("orders", "admin");   // → true

// 합집합 — "prod의 어느 리전이든 가진 권한은?"
const any = engine.unionScopes(["prod:asia", "prod:usa"]);
```

교집합/합집합 규칙:

| API | 없는 scope 처리 | 빈 입력 |
|---|---|---|
| `unionScopes(keys)` | 무시 | 전체 deny |
| `intersectScopes(keys)` | 결과 = 전체 deny (보수적) | 전체 deny |

---

## 4. PermissionSet.queryGranted — 좌표 제약 기반 질의

소스: `packages/permission-engine/src/permission-set.ts`

weighted-index의 `CoordConstraint` 문법으로 범위 조건을 걸고, grant된 주소만 반환한다.

```ts
const ps = new PermissionSet({ features, roles });
ps.grant("orders", "admin");
ps.grant("orders", "developer");

// feature=orders, role=전체 → grant된 주소만
ps.queryGranted(["2", null]);  // "2"는 orders의 ordinal

// 범위 조합: feature 1~3, role 1 또는 3
ps.queryGranted(["1-3", "1,3"]);
```

---

## 5. 선택 기준

| 상황 | 도구 |
|---|---|
| 패킹된 값에서 특정 축 하나만 빠르게 추출 | `BitIndex.extractDim()` |
| grant 집합에서 여러 축 AND 조건으로 필터 | `BitMaskSet.filterByLabels()` |
| env/region 같은 외부 차원별로 독립 관리 후 교차 | `ScopedEngine.intersectScopes()` |
| 좌표 범위 패턴("role 1~3")으로 grant 조회 | `PermissionSet.queryGranted()` |
| 반복 필터 (같은 mask, 다른 조건 여러 번) | `PermissionView.filter()` (4~6x 빠름) |
