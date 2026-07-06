---
def:
  tier: component
  id: cq-cross-index
  address: def_document:v2:68750
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [structural, query, runtime]
  links:
    - target: wi-api
      type: depends_on
sources:
  - packages/index-meta/src/cross-index-query.ts
  - packages/index-meta/src/cross-index-query.test.ts
  - packages/index-meta/src/relational-engine.ts
  - packages/query-service/src/lib/query-service.ts
  - packages/query-service/src/routes/query.ts
  - packages/query-service/src/app.test.ts
  - packages/weighted-index/src/math/calc.ts
---
# Cross-Index Query

## 목적 ^purpose

`index_ref` dim을 통해 하위 index 조건을 상위 index의 주소 범위로 변환하는 합성 질의 함수. 예를 들어 `article.quality_tier -> doc_meta` 참조에서 `doc_meta.format = PDF` 조건을 만족하는 `article` value 범위를 계산한다.

소스: `packages/index-meta/src/cross-index-query.ts`, `packages/index-meta/src/cross-index-query.test.ts`, `packages/query-service/src/lib/query-service.ts`

## 구성 ^overview

Cross-Index Query는 MetaRegistry의 `index_ref` dim metadata와 target codec의 `matchRanges()` 결과를 사용한다.

1. **composeQuery** — source index의 `index_ref` dim을 통해 target 조건을 source 주소 범위로 변환
2. **matchRanges** — 단일 prefix 내 부분 좌표 제약에서 유효 주소 범위 계산
3. **deepDecode** — `index_ref` 체인을 따라 각 index layer의 entity record를 반환

소스:
- `packages/index-meta/src/cross-index-query.ts` — composeQuery/deepDecode
- `packages/weighted-index/src/math/calc.ts` — range 대수 연산
- `packages/query-service/src/lib/query-service.ts` — composeQuery API

## composeQuery 인터페이스

> 타입 정의: packages/query-service/src/lib/query-service.ts — QueryService.composeQuery

### 동작 원리

1. source index에서 `through` dim이 존재하고 `kind.type === "index_ref"`인지 검증
2. target index의 최신 version codec으로 `targetConstraint`를 `matchRanges()` 계산
3. source version의 `through` snapshot entries 중 target range에 포함되는 position을 수집
4. 수집된 position을 `positionsToConstraint()`로 변환해 source 주소 범위를 `calcAddressRanges()`로 계산

### 사용 예시

`article.quality_tier -> doc_meta` 참조를 통한 교차 질의:

```
source = { indexId: "article", versionId: "v1" }
through = "quality_tier"
targetConstraint = { format: "PDF", lang: null }
→ doc_meta에서 format=PDF 범위 계산
→ article.quality_tier entries 중 해당 target 주소를 참조하는 position 수집
→ article 주소 범위 반환
```

## matchRanges 인터페이스

> 타입 정의: packages/query-service/src/lib/query-service.ts — QueryService.matchRanges

QueryService의 `matchRanges()`는 `RelationalEngine.matchRanges()`를 통해 해당 `MetaCodec.matchRanges()`에 위임하고, gateMode가 설정되면 gate 상태 필터를 합성한다.

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

## PartialBinder와의 경계

소스: `packages/weighted-index/src/vocab/partial-binder.ts`

PartialBinder는 SDK 부트 시 앞쪽 차원을 고정하고 런타임에 나머지만 받아 주소를 계산하는 weighted-index binding API다. `composeQuery()` 런타임은 PartialBinder를 사용하지 않으며, 두 기능은 모두 같은 range algebra를 공유하는 별도 표면이다.

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
