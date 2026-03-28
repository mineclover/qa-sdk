---
def:
  id: cq-cross-index
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [tier-infra]
  links:
    - target: wi-api
      type: depends_on
---
# Cross-Index Query

## 목적 ^purpose

서로 다른 prefix 간 공유 축을 기반으로 합성 질의를 수행하는 함수. prefix A의 결과를 prefix B의 조건으로 변환하여 교차 탐색한다.

## 구성 ^overview

Cross-Index Query는 PrefixCodec의 공유 레이블(축)을 매개로 prefix 간 주소 범위를 변환한다.

1. **composeQuery** — source prefix의 결과를 shared label을 통해 target prefix의 주소 범위로 변환
2. **matchRanges** — 단일 prefix 내 부분 좌표 제약에서 유효 주소 범위 계산
3. **PartialBinder** — 고정 차원을 캐시하고, 자유 차원만 받아 최종 주소 계산

소스:
- `packages/weighted-index/src/math/calc.ts` — range 대수 연산
- `packages/weighted-index/src/vocab/partial-binder.ts` — 차원 부분 바인딩
- `packages/query-service/src/lib/query-service.ts` — composeQuery API

## composeQuery 인터페이스

> 타입 정의: packages/query-service/src/lib/query-service.ts — QueryService.composeQuery

### 동작 원리

1. source prefix에서 through 레이블의 값 범위를 추출
2. through 레이블을 target prefix의 동일 레이블 제약 조건으로 변환
3. targetConstraint와 결합하여 target prefix의 주소 범위를 계산

### 사용 예시

role 축을 공유하는 `api_perm`과 `data_perm` 사이의 교차 질의:

```
source = { indexId: "api_perm", versionId: "pv1" }
through = "role"
targetConstraint = { action: null, resource: "orders" }
→ api_perm에서 role 범위 추출 → data_perm의 role 제약으로 변환 → 주소 범위 반환
```

## matchRanges 인터페이스

> 타입 정의: packages/query-service/src/lib/query-service.ts — QueryService.matchRanges

내부적으로 `calcAddressRanges(shape, constraints)`를 호출하여 주소 범위를 계산하고, gateMode가 설정되면 gate 상태 필터를 합성한다.

## Range 대수 연산

소스: `packages/weighted-index/src/math/calc.ts`

Cross-index 질의에 사용되는 range 연산:

| 함수 | 설명 | 용도 |
|------|------|------|
| `calcAddressRanges(shape, constraints)` | 부분 좌표 제약 → 유효 주소 범위 | 기본 범위 계산 |
| `mergeRanges(ranges)` | 인접/겹침 구간 병합 (합집합) | 결과 정규화 |
| `intersectRanges(a, b)` | 두 범위의 교집합 | AND 조건 결합 |
| `subtractRanges(base, exclude)` | 차집합 | 제외 조건 |
| `complementRanges(capacity, excluded)` | 여집합 | 전체 공간에서 제외 |
| `containsAddress(address, ranges)` | O(log n) 포함 검사 | 단일 주소 검증 |

### 최적화

- 이후 모든 차원이 와일드카드이면 하나의 연속 블록으로 처리 (재귀 없이 직접 계산)
- 외부 dim(높은 weight)을 고정할수록 적은 수의 큰 구간 생성
- 내부 dim(낮은 weight)을 고정할수록 많은 수의 작은 구간 생성

## PartialBinder를 통한 Cross-Index 활용

소스: `packages/weighted-index/src/vocab/partial-binder.ts`

PartialBinder는 SDK 부트 시 앞쪽 차원을 고정하고, 런타임에 나머지만 받아 주소를 계산한다.

```typescript
// 같은 codec에서 다른 prefix의 binder 생성
const apiPerm = createBinder(codec, "api_perm", { role: "editor" });
const dataPerm = createBinder(codec, "data_perm", { role: "editor" });

// 같은 role이지만 다른 prefix → 다른 주소 공간
apiPerm.resolveId({ action: "write", resource: "posts" });
dataPerm.resolveId({ action: "read", resource: "reports" });
```

### 점진적 체이닝

```typescript
const step1 = createBinder(codec, "full", { namespace: "shop", name: "payment" });
const step2 = step1.bind({ env: "prod", device: "web" });
const step3 = step2.bind({ region: "asia", shard: "s2" });
const addr = step3.resolveId({ resource: "orders", action: "GET" });
```

각 `bind()` 호출은 새 PartialBinder를 반환하며, 고정 차원을 누적한다. `free` 속성으로 아직 바인딩되지 않은 라벨 목록을 확인할 수 있다.

## CoordConstraint 문법

```
null      → 와일드카드 (모든 값)
"3"       → coord = 3
"2-5"     → coord = 2, 3, 4, 5
"1,3"     → coord = 1 OR 3
"1-3,7-9" → coord = 1..3 OR 7..9
```

`positionsToConstraint([6,7,8])` → `"6-8"` (position 목록을 제약 문자열로 변환)
