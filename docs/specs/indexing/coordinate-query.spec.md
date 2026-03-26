---
def:
  id: cq-original
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  layer: domain
---

# Coordinate Query 스펙

## 목적 ^purpose

n차원 좌표 공간의 패턴 포함 관계, 정책 해소, cross-index 합성 질의. (deprecated — cq-system/ 문서로 분할됨)

기반 문서: [foundation.md](foundation.md) · [data-design.md](data-design.md) · [patterns.md](patterns.md)
관련 스펙: [range-query.spec.md](weighted-index/range-query.spec.md) · [codec.spec.md](index-meta/codec.spec.md) · [resolver.spec.md](index-meta/resolver.spec.md)
운영 흐름: `[S2]` resolvePolicy · `[A5]` matchRanges/composeQuery · `[D1]` deepDecode — [runtime-flows.spec.md](../operations/runtime-flows.spec.md)

## 상태

implemented

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
│     resolvePolicy · detectConflicts (match 기반 공개 API)     │
│     resolvePatternPolicy · matchRules (position 기반 내부)    │
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

#### ❷-A 공개 API — entity name + 명시적 와일드카드

사용자는 position 숫자가 아닌 **entity 이름**으로 규칙을 정의한다. 모든 dim을 명시적으로 선언해야 하며, 와일드카드는 `"*"`로 명시한다 (암묵적 와일드카드 금지).

```ts
import { WILDCARD } from "index-meta";  // "*"

/** entity name 기반 정책 규칙 */
interface PolicyRule<T> {
  id: string;
  match: MatchSpec;     // { [dimId]: EntityId | EntityId[] | "*" }
  value: T;
  priority?: number;
}

type MatchSpec = Record<string, EntityId | readonly EntityId[] | "*">;

type ConflictStrategy =
  | 'most-specific'    // patternSpecificity가 가장 높은 패턴 승리
  | 'priority'         // 명시적 priority 기준
  | 'collect'          // 매칭되는 모든 값 수집 (배열 반환)
  | 'first-match';     // 입력 순서 기준 첫 매칭
```

**규칙 정의 예시:**

```ts
const rules: PolicyRule<string>[] = [
  // 기본: 전체 거부 (모든 dim에 "*" 명시)
  { id: "default", match: { role: "*",     action: "*",    resource: "*" },     value: "deny"  },
  // admin은 모든 action, 모든 resource 허용
  { id: "admin",   match: { role: "admin", action: "*",    resource: "*" },     value: "allow" },
  // 모든 role의 read 허용
  { id: "read",    match: { role: "*",     action: "read", resource: "*" },     value: "allow" },
  // editor는 read, write만 허용 (복수 entry 배열)
  { id: "editor",  match: { role: "editor", action: ["read", "write"], resource: "*" }, value: "allow" },
];
```

**dim 누락 → 에러** (암묵적 와일드카드 차단):

```ts
// ✗ action 누락 → ValidationError
{ match: { role: "admin", resource: "*" } }
// → 'match에 dim "action" 누락 — 와일드카드는 "action": "*"로 명시'

// ✗ unknown dim → ValidationError
{ match: { role: "admin", action: "*", resource: "*", unknown: "x" } }
// → 'match에 unknown dim "unknown"'
```

#### ❷-B 핵심 연산

| 연산 | 의미 |
|---|---|
| `resolvePolicy(codec, entities, rules, strategy)` | entity name 기반 좌표에 대해 전략에 따라 최종 값 결정 |
| `detectConflicts(codec, rules)` | 동일 좌표 범위에서 다른 값을 주장하는 규칙 쌍 탐지 |
| `ruleToPattern(codec, rule)` | PolicyRule(match) → PatternRule(position) 변환 |
| `matchToConstraints(codec, match)` | MatchSpec → CoordConstraint[] 변환 |
| `entitiesToCoord(codec, entities)` | entity name → 1-based position 배열 변환 |

**사용 예시:**

```ts
const codec = engine.codec("perm", "v1");

// 정책 해소
resolvePolicy(codec, { role: "editor", action: "read", resource: "dashboard" }, rules, "most-specific");
// → { value: "allow", matchedRules: [editor(구체성2), read(구체성1), default(구체성0)] }

resolvePolicy(codec, { role: "editor", action: "delete", resource: "settings" }, rules, "most-specific");
// → { value: "deny", matchedRules: [default(구체성0)] }

// 충돌 탐지
detectConflicts(codec, [
  { id: "admin",  match: { role: "admin", action: "*", resource: "*" },       value: "allow" },
  { id: "no-del", match: { role: "*",     action: "delete", resource: "*" },  value: "deny"  },
]);
// → [{ overlapPattern: ["1", "3", null], conflictingRules: [admin, no-del] }]
// → admin × delete에서 allow vs deny 충돌
```

#### ❷-C 내부 레이어 — PatternRule (position 기반)

공개 `PolicyRule`은 내부에서 `PatternRule`로 변환되어 ❶ Pattern Lattice 위에서 동작한다.

```ts
/** 내부 전용 — position 기반 규칙 */
interface PatternRule<T> {
  id: string;
  pattern: CoordConstraint[];   // position 범위 (예: ["1", null, "2-5"])
  value: T;
  priority?: number;
}

// 내부 함수 (position 기반)
resolvePatternPolicy(coord, rules, shape, strategy)
detectPatternConflicts(rules, shape)
matchRules(coord, rules, shape)
```

변환 흐름: `PolicyRule.match → ruleToPattern(codec) → PatternRule.pattern → resolvePatternPolicy`

#### 매칭 판정

`coordMatchesPattern(coord, pattern)` — ❶의 연산. 각 dim에서 좌표가 제약 범위에 포함되는지 확인한다. O(ndims).

#### 충돌 탐지

두 규칙의 패턴이 `patternMeet`으로 겹치는 영역이 존재하고, 값이 다르면 충돌이다:

```
규칙 R1: match={ role: "*",     action: "write", resource: "*" }  value="allow"
규칙 R2: match={ role: "viewer", action: "*",    resource: "*" }  value="deny"

겹침:    patternMeet(R1, R2) = viewer × write × *
         → viewer가 write할 때 R1은 allow, R2는 deny → 충돌

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

```ts
const codec = engine.codec("perm", "v1");
// perm index: role(8) × action(4) × resource(16)

const rules: PolicyRule<string>[] = [
  { id: "R1", match: { role: "*",     action: "*",      resource: "*" },       value: "deny"  },
  { id: "R2", match: { role: "admin", action: "*",      resource: "*" },       value: "allow" },
  { id: "R3", match: { role: "*",     action: "delete", resource: "*" },       value: "deny"  },
  { id: "R4", match: { role: "admin", action: "delete", resource: "*" },       value: "allow" },
];

resolvePolicy(codec, { role: "admin", action: "delete", resource: "doc-7" }, rules, "most-specific");
// matchRules → [R4, R2, R3, R1]  (구체성 순)
// → R4 → "allow"

resolvePolicy(codec, { role: "viewer", action: "delete", resource: "doc-7" }, rules, "most-specific");
// matchRules → [R3, R1]
// → R3 → "deny"
```

**기존 방법**: 호출자가 규칙 우선순위를 직접 관리하고 if-else 체인으로 판정.
**이 스펙 적용 후**: entity name으로 규칙을 선언하고 `resolvePolicy`에 위임. 충돌은 `detectConflicts`로 사전 탐지.

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

---

## 7. policy-resolver 상세

### 핵심 타입

```ts
interface PolicyRule<T> {
  id: string;
  pattern: CoordConstraint[];   // dim별 제약
  value: T;                      // 규칙이 주장하는 값
  priority?: number;             // 명시적 우선순위 (priority 전략용)
}

type ConflictStrategy =
  | "most-specific"    // patternSpecificity 최고값 승리
  | "priority"         // 명시적 priority 내림차순
  | "collect"          // 모든 매칭 값 수집 (T[] 반환)
  | "first-match";     // 입력 순서 첫 매칭

interface ResolveResult<T> {
  value: T | T[];                 // 해소된 값 (collect면 T[])
  matchedRules: PolicyRule<T>[];  // 구체성 내림차순 정렬
  strategy: ConflictStrategy;
}

interface ConflictReport<T> {
  overlapPattern: CoordConstraint[];       // 두 규칙의 교집합 패턴
  conflictingRules: PolicyRule<T>[];       // 같은 영역, 다른 값
}
```

### matchRules 알고리즘

```ts
function matchRules<T>(
  coord: number[],
  rules: PolicyRule<T>[],
  shape: readonly number[],
): PolicyRule<T>[]
```

1. 각 규칙에 대해 `coordMatchesPattern(coord, rule.pattern)` 실행
2. 매칭된 규칙을 `patternSpecificity(rule.pattern, shape)` 내림차순 정렬
3. 복잡도: O(N × ndims) — N = 규칙 수

### resolvePolicy 4전략

```ts
function resolvePolicy<T>(
  coord: number[],
  rules: PolicyRule<T>[],
  shape: readonly number[],
  strategy: ConflictStrategy,
): ResolveResult<T> | null
```

1. `matchRules(coord, rules, shape)` 호출
2. 매칭 없으면 `null` 반환
3. 전략별 처리:
   - **most-specific**: 첫 번째 매칭 규칙 (이미 specificity 내림차순)
   - **priority**: `.priority` 필드 내림차순 재정렬 후 첫 번째
   - **collect**: 모든 매칭 값을 배열로 수집
   - **first-match**: 원래 입력 순서에서 첫 매칭 규칙

### detectConflicts 사전 검증

```ts
function detectConflicts<T>(
  rules: PolicyRule<T>[],
  shape: readonly number[],
  eq?: (a: T, b: T) => boolean,  // 기본: (a, b) => a === b
): ConflictReport<T>[]
```

1. 모든 규칙 쌍 (i, j)에 대해 `patternMeet(rules[i].pattern, rules[j].pattern, shape)` 계산
2. 교집합이 non-null이고 `!eq(rules[i].value, rules[j].value)`이면 충돌
3. 복잡도: O(N² × ndims) — 빌드 타임 전용

---

## 8. cross-index-query 상세

### composeQuery 5단계 흐름

```ts
function composeQuery(
  source: { indexId: string; versionId: string },
  through: string,       // source의 index_ref dim ID
  targetConstraint: Record<string, EntityId | null>,
  registry: MetaRegistry,
): [number, number][]
```

| 단계 | 동작 |
|---|---|
| ① 검증 | `through` dim이 source에 존재하고 `kind.type === "index_ref"`인지 확인 |
| ② 대상 범위 | target index의 codec으로 `matchRanges(targetConstraint)` → target 값 범위 |
| ③ 포지션 매핑 | source의 through dim entries에서 target 범위에 포함되는 값의 1-based position 수집 |
| ④ 소스 제약 구성 | through dim = `positionsToConstraint(positions)`, 나머지 = null (wildcard) |
| ⑤ 소스 범위 | `calcAddressRanges(sourceShape, sourceConstraints)` → 최종 범위 |

### deepDecode 재귀 알고리즘

```ts
function deepDecode(
  address: VersionedValue,
  registry: MetaRegistry,
  maxDepth?: number,        // 기본값 8
): DeepDecodeResult

interface DeepDecodeResult {
  layers: Map<string, Record<string, EntityId>>;  // indexId → 디코드된 entity
  path: VersionedValue[];                         // 루트 → 리프 경로
}
```

**알고리즘** (visited set — INV-10):

1. `visited = new Set<string>()`, key = `"${indexId}:${versionId}:${value}"`
2. 현재 노드가 visited에 있거나 depth ≤ 0이면 종료
3. `visited.add(key)`, codec.decode(vv) → entity record
4. **dim-level index_ref**: dimDef.kind.type === "index_ref"이고 decoded 값이 number이면, target index로 재귀
5. **entry-level entryRefs**: snapshot의 entryRefs에 해당 position이 있으면, ref의 index로 재귀
6. 양쪽 경로를 모두 따라감

**INV-10**: visited set로 순환 참조 방지. 같은 (indexId, versionId, value) 조합은 두 번 방문하지 않는다.

---

## 9. version-query 상세

### queryAcrossVersions

```ts
function queryAcrossVersions(
  indexId: string,
  versionIds: string[],
  constraint: Record<string, EntityId | null>,
  registry: MetaRegistry,
): Map<string, [number, number][]>
```

각 version에서 entity 이름 기준 `matchRanges` 실행. entity가 해당 version에 없으면 (`EntryNotFoundError`) 해당 version은 결과에서 제외.

### entityVersionSpan

```ts
function entityVersionSpan(
  indexId: string,
  dimId: string,
  entityId: EntityId,
  registry: MetaRegistry,
  options?: { activeOnly?: boolean },
): string[]
```

모든 version의 DimSnapshot을 순회하여 entity 존재 여부 확인.
`activeOnly: true`이면 entryFlags에서 inactive인 position 제외.

### translateConstraint

```ts
function translateConstraint(
  indexId: string,
  fromVersion: string,
  toVersion: string,
  constraint: Record<string, CoordConstraint>,
  registry: MetaRegistry,
): Record<string, CoordConstraint> | null
```

**흐름**:
1. `fromVersion === toVersion`이면 그대로 반환
2. 각 dim에 대해:
   - 양 version의 snapshot이 동일하면 제약 유지
   - 다르면: position → entity 변환 후, target version에서 entity → position 역변환
   - **migration edge 우선**: `traceMigration(dimId, from, to, pos)` 시도
   - **EntityId fallback**: entity가 target version entries에 존재하면 position 매핑
   - entity가 target에 없으면 `null` 반환 (변환 불가)
3. `positionsToConstraint(mappedPositions)`로 새 제약 문자열 생성

---

## 10. RelationalEngine

facade 클래스로, MetaRegistry + 좌표 질의 모듈을 통합한다.

### 2-level 규칙 엔진

```ts
interface RelationTypeRule<T> {
  id: string;
  pattern: CoordConstraint[];         // 타입 수준 패턴 (subject_kind × predicate × object_kind)
  effect: T;                          // 타입 수준 효과
  instanceRules?: {                   // 선택적 2차 수준
    indexId: string;
    versionId: string;
    rules: PolicyRule<T>[];           // 인스턴스 수준 규칙
    strategy: ConflictStrategy;
  };
  priority?: number;
}

interface RelationResolveResult<T> {
  value: T;                           // 최종 값
  typeLevel: ResolveResult<T>;        // 타입 수준 매칭 결과
  instanceLevel?: ResolveResult<T> | null;  // 인스턴스 수준 결과
}
```

### resolveRelation 흐름

```ts
resolveRelation<T>(
  relTypeCoord: number[],
  relShape: readonly number[],
  typeRules: RelationTypeRule<T>[],
  typeStrategy: ConflictStrategy,
  instanceCoord?: number[],
): RelationResolveResult<T> | null
```

**Level 1 (타입)**:
1. `RelationTypeRule<T>[]` → `PolicyRule<T>[]` 변환 (`effect` → `value`)
2. `resolvePolicy(relTypeCoord, typePolicyRules, relShape, typeStrategy)`
3. 매칭 없으면 `null`

**Level 2 (인스턴스)** (조건부):
1. 매칭된 type rule에 `instanceRules`가 있고 `instanceCoord`가 제공된 경우
2. instance index의 WeightedIndex로 `resolvePolicy(instanceCoord, instRules, instShape, instStrategy)`
3. 결과를 `RelationResolveResult`에 포함

### facade 메서드 목록

| 메서드 | 위임 대상 |
|---|---|
| `codec(indexId, versionId)` | `registry.createCodec()` |
| `encode(indexId, versionId, entities)` | `codec.encode()` |
| `decode(indexId, versionId, vv)` | `codec.decode()` |
| `matchRanges(indexId, versionId, partial)` | `codec.matchRanges()` |
| `addressRanges(indexId, versionId, constraints)` | `calcAddressRanges()` |
| `contains(value, ranges)` | `containsAddress()` |
| `composeQuery(source, through, targetConstraint)` | 독립 `composeQuery()` |
| `deepDecode(address, maxDepth?)` | 독립 `deepDecode()` |
| `matchRules(coord, rules, shape)` | 독립 `matchRules()` |
| `resolvePolicy(coord, rules, shape, strategy)` | 독립 `resolvePolicy()` |
| `detectConflicts(rules, shape, eq?)` | 독립 `detectConflicts()` |
| `resolveRelation(...)` | 2-level 엔진 |

---

## 11. 테스트 맵

### cross-index-query.test.ts

| 시나리오 | 설명 |
|---|---|
| composeQuery 기본 | 단일/복수 제약 매칭 |
| composeQuery 에러 | entry 미발견, 검증 에러 |
| deepDecode 2-level | index_ref 2단계 확장 |
| deepDecode 단일 | 참조 없는 단일 index |
| deepDecode 깊이 제한 | maxDepth 초과 시 중단 |
| deepDecode 순환 방지 | dim-level + entry-level 순환 참조 |

### policy-resolver.test.ts

| 시나리오 | 설명 |
|---|---|
| matchRules | 좌표별 매칭 + specificity 정렬 |
| resolvePolicy 4전략 | most-specific, priority, collect, first-match |
| detectConflicts | 겹침 탐지 + 커스텀 eq 함수 |

### relational-engine.test.ts

| 시나리오 | 설명 |
|---|---|
| encode/decode | 왕복 검증 |
| matchRanges | 부분 질의 + containment |
| resolvePolicy (1-level) | 3-규칙 매칭 (default/admin/editor) |
| resolveRelation (2-level) | 타입 + 인스턴스 매칭 |
| detectConflicts | 겹침 탐지 |
| composeQuery + deepDecode | cross-index 통합 |

### relational-engine.e2e.test.ts

| 시나리오 | 설명 |
|---|---|
| RBAC 스키마 | rel (subject_kind × predicate × object_kind) + perm (role × action × resource) |
| E2E 파이프라인 | 스키마 정의 → DB 삽입 → 범위 캐시 → 이진 탐색 |
| 정책 해소 | specificity 기반 충돌 해소 + 좌표 전체 공간 검증 |
