# Coordinate Query 스펙

> 닫힌 공간 위의 **패턴 포함 관계, 정책 해소, cross-index 합성 질의, 버전 횡단 탐색**을 다루는 n차원 연산 계층.
> 기존 `calcAddressRanges` 범위 대수(range algebra) 위에 lattice, policy, join, version 연산을 쌓는다.

기반 문서: [foundation.md](foundation.md) · [data-design.md](data-design.md) · [patterns.md](patterns.md)
관련 스펙: [range-query.spec.md](weighted-index/range-query.spec.md) · [codec.spec.md](index-meta/codec.spec.md) · [resolver.spec.md](index-meta/resolver.spec.md)

## 상태

planned

---

## 1. 목적

### 현재 상태

기존 시스템은 **단일 index, 단일 version, 단일 제약**에서의 주소 구간 계산에 최적화되어 있다.

| 가능한 것 | 불가능한 것 |
|---|---|
| `role=3`인 주소 구간 계산 | 패턴 A가 패턴 B를 **포함**하는지 판정 |
| 범위의 합집합·교집합·차집합 | 여러 규칙 중 **가장 구체적인 것** 선택 |
| cross-index 참조 디코딩 (수동) | cross-index **합성 질의** (자동) |
| 단일 버전 범위 조회 | **여러 버전에 걸친** entity 기준 탐색 |

### 해결하려는 문제

닫힌 공간의 조합이 **규칙, 정책, 접근제어, 스코프 필터**로 사용될 때, 단순 범위 계산만으로는 다음 질문에 답할 수 없다:

- "이 좌표에 적용되는 규칙이 여러 개일 때 어떤 것이 이기는가?"
- "하위 index의 조건을 만족하는 상위 index 주소는 무엇인가?"
- "v1부터 v5까지 `role=admin`인 주소를 모두 찾아라"
- "`(admin, *, *)`이 `(admin, read, *)`를 포함하는가?"

이 스펙은 기존 range algebra를 **lattice → policy → cross-index → version** 순으로 확장하여 위 질문들에 답할 수 있는 연산 계층을 정의한다.

---

## 2. 레이어 배치

기존 레이어 분리를 유지하면서 3개 연산 계층을 추가한다.

```
┌──────────────────────────────────────────────────────────────┐
│  데이터 레이어  (사용자 구현)                                  │
├──────────────────────────────────────────────────────────────┤
│  ❸ Cross-Index / Version Query  (index-meta 확장)            │
│     composeQuery · deepDecode · queryAcrossVersions          │
├──────────────────────────────────────────────────────────────┤
│  ❷ Policy Resolution  (index-meta 신규 모듈)                 │
│     matchRules · resolvePolicy · detectConflicts             │
├──────────────────────────────────────────────────────────────┤
│  ❶ Pattern Lattice  (weighted-index/calc.ts 확장)            │
│     constraintContains · patternMeet · patternJoin           │
│     patternSpecificity · coordMatchesPattern                 │
├──────────────────────────────────────────────────────────────┤
│  기존: 스키마 레이어 (index-meta)                             │
├──────────────────────────────────────────────────────────────┤
│  기존: 수학 레이어 (weighted-index)                           │
│     calcAddressRanges · mergeRanges · intersectRanges 등     │
└──────────────────────────────────────────────────────────────┘
```

의존 방향: ❶ → 기존 calc.ts, ❷ → ❶, ❸ → ❷ + MetaRegistry

### 패키지 배치

| 계층 | 패키지 | 이유 |
|---|---|---|
| ❶ Pattern Lattice | `weighted-index` | 순수 수학. shape과 CoordConstraint만 필요, schema 의존 없음 |
| ❷ Policy Resolution | `index-meta` | 규칙의 값(T)이 도메인 타입. schema 컨텍스트 없이도 동작하나 index-meta가 자연스러운 위치 |
| ❸ Cross-Index / Version | `index-meta` | MetaRegistry, DimSnapshot, index_ref 등 schema 컨텍스트 필수 |

---

## 3. 제공 기능

### ❶ Pattern Lattice — 패턴 포함 관계와 격자 연산

기존 `CoordConstraint`(null, `"3"`, `"2-5"`, `"1,3,7-9"`)를 dim별 constraint 배열 = **패턴**으로 다루고, 패턴 간 포함 관계(partial order)를 정의한다.

#### 핵심 연산

| 연산 | 입력 | 출력 | 의미 |
|---|---|---|---|
| `constraintContains(a, b, dimSize)` | 두 단일 dim 제약 | boolean | a의 값 집합 ⊇ b의 값 집합? |
| `patternContains(shape, a, b)` | 두 패턴 | boolean | a의 주소 집합 ⊇ b의 주소 집합? |
| `patternMeet(a, b)` | 두 패턴 | 패턴 \| null | greatest lower bound (교집합 패턴). null이면 공집합 |
| `patternJoin(a, b, shape)` | 두 패턴 | 패턴 | least upper bound (합집합을 포함하는 최소 패턴) |
| `patternSpecificity(pattern, shape)` | 패턴 | number | 구체성 점수. wildcard가 적을수록 높음 |
| `coordMatchesPattern(coord, pattern)` | 좌표, 패턴 | boolean | 특정 좌표가 패턴에 포함되는가? |

#### 포함 관계 예시

```
shape = [8, 4, 16]   (role × action × resource)

패턴 A: [null,  null, null]     ← 모든 주소        (specificity = 0)
패턴 B: ["3",   null, null]     ← role=3인 주소     (specificity = 0.875)
패턴 C: ["3",   "2",  null]     ← role=3, action=2  (specificity = 1.625)
패턴 D: ["3",   "2",  "5"]     ← 단일 좌표          (specificity = 2.5625)

포함 관계: A ⊇ B ⊇ C ⊇ D

patternContains(shape, A, B) → true
patternContains(shape, B, C) → true
patternContains(shape, C, D) → true
patternContains(shape, D, C) → false
```

#### 알고리즘 기반

`constraintContains(a, b)`의 판정은 기존 `subtractRanges`를 재사용한다:

```
a ⊇ b  ⟺  subtractRanges(rangesOf(b), rangesOf(a)).length === 0
```

b에서 a를 빼면 아무것도 안 남으면, a가 b를 완전히 포함한다. 새 자료구조 없음.

---

### ❷ Policy Resolution — 규칙 매칭과 충돌 해소

좌표 공간에 겹치는 규칙(패턴 + 값)이 여러 개 있을 때, 특정 좌표에 어떤 규칙이 적용되는지 결정한다.

#### 핵심 타입

```ts
interface PolicyRule<T> {
  id: string;
  pattern: CoordConstraint[];   // 이 규칙이 적용되는 좌표 범위
  value: T;                      // 규칙이 주장하는 값
  priority?: number;             // 명시적 우선순위 (선택)
}

type ConflictStrategy =
  | 'most-specific'    // patternSpecificity가 가장 높은 패턴 승리
  | 'priority'         // 명시적 priority 기준
  | 'collect'          // 매칭되는 모든 값 수집 (배열 반환)
  | 'first-match';     // 입력 순서 기준 첫 매칭
```

#### 핵심 연산

| 연산 | 의미 |
|---|---|
| `matchRules(coord, rules, shape)` | 좌표에 매칭되는 모든 규칙 반환 (구체성 내림차순) |
| `resolvePolicy(coord, rules, shape, strategy)` | 전략에 따라 최종 값 결정 |
| `detectConflicts(rules, shape)` | 동일 좌표 범위에서 다른 값을 주장하는 규칙 쌍 탐지 |

#### 매칭 판정

`coordMatchesPattern(coord, pattern)` — ❶의 연산. 각 dim에서 좌표가 제약 범위에 포함되는지 확인한다. O(ndims).

#### 충돌 탐지

두 규칙의 패턴이 `patternMeet`으로 겹치는 영역이 존재하고, 값이 다르면 충돌이다:

```
규칙 R1: pattern=[null, "2", null],  value="allow"    ← action=2이면 허용
규칙 R2: pattern=["3",  null, null], value="deny"     ← role=3이면 거부

겹침:    patternMeet(R1, R2) = ["3", "2", null]
         → role=3이면서 action=2인 좌표에서 R1은 allow, R2는 deny → 충돌

해소:    strategy='most-specific' → R2.specificity ≈ 0.88, R1.specificity ≈ 0.75
         → R2 승리 → "deny"
```

---

### ❸-A Cross-Index Query — index_ref 합성 질의

`index_ref` dim을 통해 연결된 하위 index에 조건을 걸고, 그 조건을 만족하는 **상위 index의 주소 범위**를 자동으로 계산한다.

#### 핵심 연산

| 연산 | 의미 |
|---|---|
| `composeQuery(source, through, targetConstraint, registry)` | 하위 index 조건 → 상위 index 주소 범위 |
| `deepDecode(address, registry, maxDepth?)` | index_ref 체인을 끝까지 따라가서 모든 리프 entity 반환 |

#### composeQuery 흐름

```
article index = [quality_tier(→doc_meta), priority]
doc_meta index = [format, lang]

질문: "format=PDF인 article의 주소 범위는?"

① doc_meta에서 format=PDF인 주소 계산
   calcAddressRanges(doc_meta_shape, ["2", null]) → [[4, 7]]

② article의 quality_tier dim entries에서
   doc_meta 주소 4~7에 해당하는 position 찾기
   → positions = [5, 6, 7, 8]  (entries에서 값 4,5,6,7을 가진 위치)

③ article 주소 범위 계산
   calcAddressRanges(article_shape, ["5-8", null]) → [[20, 39]]

결과: article 주소 20~39가 format=PDF인 article
```

현재 이 과정은 호출자가 수동으로 3단계를 수행해야 한다. `composeQuery`는 이를 단일 호출로 자동화한다.

#### deepDecode 흐름

```
L2 주소 → decode → article coords → quality_tier 값
  → doc_meta decode → format + lang
  → 모든 리프 entity를 Map으로 반환

deepDecode(vv, registry)
→ {
    "article":  { quality_tier: 9, priority: 4 },
    "doc_meta": { format: "PDF", lang: "ko" },
  }
```

현재의 수동 cross-index decode 패턴을 재귀적으로 자동화한다.

---

### ❸-B Version-Aware Query — 버전 횡단 탐색

entity 기준 조건을 여러 version에 걸쳐 검색한다. 좌표 번호가 아닌 **entity 이름** 기준이므로, version마다 position이 달라도 동일한 의미 조건을 적용할 수 있다.

#### 핵심 연산

| 연산 | 의미 |
|---|---|
| `queryAcrossVersions(indexId, versionIds, constraint, registry)` | entity 조건 → version별 주소 범위 |
| `entityVersionSpan(indexId, dimId, entityId, registry)` | 특정 entity가 존재하는 version 목록 |
| `translateConstraint(indexId, from, to, constraint, registry)` | 버전 간 제약 조건 변환 |

#### queryAcrossVersions 흐름

```
"v1~v3에서 role=admin인 주소를 모두 찾아라"

v1: shape=[3,3,3], admin=position 1
    calcAddressRanges([3,3,3], ["1", null, null]) → [[0, 8]]

v2: shape=[4,3,3], admin=position 1 (append-only이므로 동일)
    calcAddressRanges([4,3,3], ["1", null, null]) → [[0, 8]]

v3: shape=[4,4,3], admin=position 1
    calcAddressRanges([4,4,3], ["1", null, null]) → [[0, 11]]

결과: Map { "v1" → [[0,8]], "v2" → [[0,8]], "v3" → [[0,11]] }
```

entity 이름 기준이므로 호출자는 version별 position 차이를 알 필요 없다.

#### translateConstraint 흐름

```
v1에서 작성한 제약 { role: "1", action: "2" }를 v3 기준으로 변환:

dim "role": v1 position 1 → migration edge → v3 position 1 (동일)
dim "action": v1 position 2 → migration edge → v3 position 3 (순서 변경)

결과: { role: "1", action: "3" }
```

migration edge가 없으면 EntityId 기반 암묵적 이동을 시도한다.

---

## 4. 예상 Use Case

### UC-1: RBAC 권한 평가 — "이 사용자가 이 리소스에 접근할 수 있는가?"

```
shape = [role(8), action(4), resource(16)]

규칙:
  R1: [null,  null, null]   → "deny"          (기본 거부)
  R2: ["1",   null, null]   → "allow"         (admin은 전부 허용)
  R3: [null,  "4",  null]   → "deny"          (delete는 전부 거부)
  R4: ["1",   "4",  null]   → "allow"         (admin의 delete는 허용)

질의: coord=[1, 4, 7] (admin, delete, doc-7)
  matchRules → [R4, R2, R3, R1]  (구체성 순)
  resolvePolicy('most-specific') → R4 → "allow"
```

**기존 방법**: 호출자가 규칙 우선순위를 직접 관리하고 if-else 체인으로 판정.
**이 스펙 적용 후**: 규칙을 선언하고 `resolvePolicy`에 위임. 충돌은 `detectConflicts`로 사전 탐지.

---

### UC-2: cross-index 스코프 필터 — "특정 문서 유형의 article만 조회"

```
doc_meta = [format(3), lang(4)]
article  = [quality_tier(→doc_meta, 12), priority(5)]

질문: "format=PDF이고 lang=ko인 article의 주소 범위"

composeQuery(
  source: { indexId: "article", versionId: "v1" },
  through: "quality_tier",
  targetConstraint: { format: "PDF", lang: "ko" },
  registry,
)
→ [[...]]    // DB WHERE article_address BETWEEN ... 으로 직접 사용
```

**기존 방법**: doc_meta encode → entries에서 position 검색 → article 범위 계산 (3단계 수동).
**이 스펙 적용 후**: 단일 `composeQuery` 호출.

---

### UC-3: 버전 마이그레이션 영향 분석 — "v3으로 올리면 admin 주소가 어떻게 바뀌는가?"

```
translateConstraint("perm", "v1", "v3", { role: "1", action: null, resource: null })
→ { role: "1", action: null, resource: null }   // position 동일
   또는
→ { role: "2", action: null, resource: null }   // migration edge에 의해 이동

queryAcrossVersions("perm", ["v1", "v2", "v3"], { role: "admin" })
→ Map {
    "v1" → [[0, 63]],
    "v2" → [[0, 63]],
    "v3" → [[64, 127]],   // v3에서 admin position이 2로 변경됨
  }
```

**기존 방법**: 각 version에 대해 수동으로 entity position 조회 + 범위 계산.
**이 스펙 적용 후**: entity 이름 기준으로 version별 주소 범위를 한 번에 획득.

---

### UC-4: 규칙 충돌 사전 탐지 — "배포 전에 정책 충돌이 있는가?"

```
규칙:
  R1: [null,  "2", null]  → rate_limit: 100
  R2: ["3",   null, null] → rate_limit: 500
  R3: ["3",   "2",  null] → rate_limit: 200

detectConflicts([R1, R2, R3], shape)
→ [
    { overlapPattern: ["3", "2", null],
      conflictingRules: [R1, R2] },   // R1=100 vs R2=500, 겹침 영역 존재
  ]
// R3는 같은 영역에 대해 명시적 값(200)을 제공하므로
// most-specific 전략에서 R3가 R1, R2보다 우선
```

**기존 방법**: 규칙 수가 늘어나면 사람이 겹침을 파악하기 어렵고, 배포 후 예기치 않은 동작으로 발견됨.
**이 스펙 적용 후**: `detectConflicts`로 빌드 타임에 겹침과 전략별 해소 결과를 확인.

---

### UC-5: 깊은 디코딩 — "이 주소가 가리키는 모든 리프 entity를 보여줘"

```
L0: format(3) × lang(4) = 12
L1: doc_meta(→L0, 12) × priority(5) = 60
L2: article(→L1, 60) × region(8) = 480

deepDecode({ indexId: "article_regional", versionId: "v1", value: 247 }, registry)
→ {
    layers: Map {
      "article_regional" → { article: 30, region: 7 },
      "article"          → { doc_meta: 5, priority: 0 },
      "doc_meta"         → { format: 1, lang: 1 },
    },
    path: [vv_L2, vv_L1, vv_L0],
  }
```

**기존 방법**: 호출자가 decode → index_ref 확인 → 다시 decode를 레벨 수만큼 반복.
**이 스펙 적용 후**: `deepDecode` 단일 호출로 전체 계층 펼침.

---

### UC-6: entity 생존 범위 확인 — "이 entity가 어느 버전부터 어느 버전까지 존재하는가?"

```
entityVersionSpan("perm", "role", "viewer", registry)
→ ["v2", "v3", "v4"]    // v1에는 없었고 v2에서 추가, v4까지 존재

// viewer가 v5에서 inactive 처리된 경우에도 entries에는 존재하므로 포함됨
// entryFlags 기준 active 여부를 별도로 확인하려면 옵션 제공
entityVersionSpan("perm", "role", "viewer", registry, { activeOnly: true })
→ ["v2", "v3"]          // v4에서 inactive 처리됨
```

**기존 방법**: 모든 version의 DimSnapshot을 순회하면서 entries에 entity 존재 여부를 수동 확인.
**이 스펙 적용 후**: 단일 호출로 entity의 전체 생존 범위 획득.

---

## 5. 연산 비용

모든 연산은 닫힌 공간(entries 수백 이하)에서 동작하므로 실용적 범위 내다.

| 연산 | 비용 | 병목 |
|---|---|---|
| `constraintContains` | O(ranges) | subtractRanges 1회 |
| `patternContains` | O(ndims × ranges) | dim 수 × dim별 range count |
| `patternMeet` | O(ndims × ranges) | dim별 intersection |
| `coordMatchesPattern` | O(ndims) | dim별 range check |
| `resolvePolicy` (N rules) | O(N × ndims) | 전체 규칙 스캔 |
| `detectConflicts` (N rules) | O(N² × ndims) | 쌍별 비교 |
| `composeQuery` | O(entries) + O(rangeCalc) | target entries scan |
| `deepDecode` (D levels) | O(D × decode) | 레벨 수 × decode 비용 |
| `queryAcrossVersions` (V versions) | O(V × rangeCalc) | 버전 수 × 범위 계산 |

### 빌드 타임 / 런타임 분리

`detectConflicts`와 `queryAcrossVersions`는 O(N²) 또는 O(V)이므로 빌드 타임에 사전 계산하는 것이 적합하다. 런타임에는 `resolvePolicy`(O(N × ndims))와 `coordMatchesPattern`(O(ndims))만 사용한다.

이 분리는 기존 [data-design.md](data-design.md) §5 캐싱 전략과 동일한 패턴이다.

---

## 6. 구현 우선순위

| 순서 | 모듈 | 위치 | 이유 |
|---|---|---|---|
| 1 | Pattern Lattice (❶) | weighted-index | 나머지 전부의 기반. calc.ts에 6개 함수 추가 |
| 2 | Cross-Index Query (❸-A) | index-meta | index_ref 패턴이 이미 존재하지만 수동. 자동화 효과 즉시 체감 |
| 3 | Policy Resolution (❷) | index-meta | 권한/정책 시나리오에서 바로 사용. ❶만 있으면 구현 가능 |
| 4 | Version-Aware Query (❸-B) | index-meta | 운영 단계에서 필요. 초기 개발에서는 단일 version으로 충분 |
