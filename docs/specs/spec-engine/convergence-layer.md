---
def:
  id: convergence-layer-spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  tags: [tier-system]
  links:
    - target: spec-core-types
      type: depends_on
---
# Convergence Layer — 수렴/비교/인과 발견

## 목적 ^purpose

좌표 시스템의 심볼들이 점차 수렴하도록 돕는 분석 계층.
관측 데이터와 DKG 그래프를 조합하여 수렴 기회를 발견하고,
prefix가 최소 가짓수를 유지하면서 로직을 보존하게 한다.

모든 것이 고유 심볼이면서도, 인과관계가 발견되면 이어지고,
데이터의 흐름이 prefix를 중심으로 결정되게 한다.

기반: [design-knowledge-graph.md](design-knowledge-graph.md) · [dkg-skills.md](dkg-skills.md) · [spec-propagation.md](spec-propagation.md) · [../indexing/weighted-index/traceability.spec.md](../indexing/weighted-index/traceability.spec.md)

---

## 목표

1. **prefix와 이벤트의 유지를 명시적 시스템 스펙으로 관리한다**
2. **전체 흐름과 구성과 분기처리의 현황을 수집하며 보여준다**
3. **지식이 수렴하여 전체 시스템을 조망할 수 있게 한다**
4. **비슷한 심볼의 의사결정을 비교하여 병합 여부를 판별한다**
5. **모든 것이 고유 심볼이면서 인과관계가 발견되면 이어진다**
6. **prefix는 로직을 유지하면서 최소 가짓수를 유지한다**
7. **시스템이 적절한 바운더리에 새 prefix 생성을 돕는다**

---

## 위치

```
┌─────────────────────────────────────────────────────┐
│  Convergence Layer (이 문서)                         │
│  · SymbolComparator     심볼 비교                    │
│  · DecisionComparator   결정 비교                    │
│  · CausalDiscovery      인과 발견                    │
│  · SimplificationAdvisor 최소 가짓수                 │
│  · BoundaryRecommender  경계 추천                    │
├─────────────────────────────────────────────────────┤
│  DKG + Skills + Propagation (구현 완료)              │
├─────────────────────────────────────────────────────┤
│  좌표 시스템 (구현 완료)                              │
└─────────────────────────────────────────────────────┘

입력: DKG GraphRegistry (구조) + UsageData (관측 집계)
출력: Observation 노드 → Decision scaffold → propagation
```

---

## 관측 데이터 인터페이스

수렴 레이어의 입력이 되는 관측 집계 데이터. qa-sdk의 EventRecord.address_context에서 파생된다.

```typescript
/** 축 entry별 사용 빈도 */
interface EntryUsage {
  readonly axisId: string;
  readonly entry: string;
  readonly count: number;
  readonly lastSeen: string;  // ISO-8601
}

/** prefix 주소별 사용 빈도 */
interface AddressUsage {
  readonly prefix: string;
  readonly version: string;
  readonly address: number;
  readonly count: number;
}

/** 두 prefix 주소의 동시 출현 */
interface CoOccurrence {
  readonly sourcePrefix: string;
  readonly sourceEntry: string;
  readonly targetPrefix: string;
  readonly targetEntry: string;
  readonly count: number;
  readonly totalSourceCount: number;  // source 단독 출현 횟수
}

/** 관측 집계 데이터 전체 */
interface UsageData {
  readonly entryUsages: readonly EntryUsage[];
  readonly addressUsages: readonly AddressUsage[];
  readonly coOccurrences: readonly CoOccurrence[];
  readonly collectionPeriod: { from: string; to: string };
}
```

이 데이터는 수렴 레이어가 **소비할 뿐 생성하지 않는다.** 생성은 qa-sdk의 관측 계층이 담당한다 (다음 스펙).

---

## 1. SymbolComparator — 심볼 비교

### 목적

"이 두 축(또는 prefix)이 같은 뜻 아닌가?" — entries 중복, 공유 패턴을 검사하여 수렴 기회를 발견한다.

### 축 비교

```typescript
interface AxisOverlap {
  readonly a: string;
  readonly b: string;
  readonly sharedEntries: readonly string[];
  readonly aOnly: readonly string[];
  readonly bOnly: readonly string[];
  readonly overlapRatio: number;
  readonly recommendation: "merge" | "alias" | "keep-separate" | "review";
  readonly reason: string;
}
```

**비교 로직:**

```
1. 두 축의 entries 집합을 비교
2. 교집합 크기 / 합집합 크기 = Jaccard 유사도
3. 판정:
   Jaccard ≥ 0.7  → merge 추천
   0.3 ≤ J < 0.7  → review (인간 확인)
   J < 0.3        → keep-separate
4. 같은 prefix에서 사용되면 → alias 추천 (병합 대신 이름 정리)
```

### prefix 비교

```typescript
interface PrefixOverlap {
  readonly a: string;
  readonly b: string;
  readonly sharedAxes: readonly string[];
  readonly sharedRefs: readonly string[];
  readonly structuralSimilarity: number;  // 0~1
  readonly recommendation: "merge" | "split" | "keep-separate" | "review";
  readonly reason: string;
}
```

**비교 로직:**

```
1. 두 prefix의 dims에서 같은 axisId를 참조하는 차원 추출
2. 같은 prefix를 references하는지 확인
3. 구조적 유사도 = (공유 축 + 공유 참조) / (전체 축 합집합)
4. 판정:
   유사도 ≥ 0.7  → merge 추천
   0.3 ≤ S < 0.7 → review
   S < 0.3       → keep-separate
```

---

## 2. DecisionComparator — 결정 비교

### 목적

같은 대상에 대한 두 결정이 충돌하거나 중복되는지 검사한다. Decision 노드의 lifecycle과 justifies 대상을 기반으로 비교한다.

```typescript
interface DecisionConflict {
  readonly a: string;
  readonly b: string;
  readonly sharedTargets: readonly string[];
  readonly conflict: "contradictory" | "redundant" | "superseding" | "compatible";
  readonly resolution: string;
}
```

**비교 로직:**

```
1. 두 Decision의 justifies 대상 교집합 확인
2. 교집합이 비어있으면 → compatible (서로 다른 대상)
3. 교집합이 있으면:
   a. 한쪽이 superseded → superseding (이미 대체됨)
   b. 양쪽 rationale이 상반 → contradictory (인간 해소 필요)
   c. 양쪽 rationale이 유사 → redundant (하나로 통합)
   d. 나머지 → compatible
```

### 전체 결정 스캔

```typescript
/** 활성 Decision 전체에서 충돌/중복 쌍을 찾는다 */
function scanDecisionConflicts(graph: GraphRegistry): DecisionConflict[];
```

---

## 3. CausalDiscovery — 인과 발견

### 목적

관측 데이터의 co-occurrence에서 인과 관계 후보를 추출하고, 확인되면 DKG에 IntentLink로 고정한다.

```typescript
interface CausalCandidate {
  readonly source: { prefix: string; entry: string };
  readonly target: { prefix: string; entry: string };
  readonly coOccurrenceRate: number;  // target 출현 / source 출현
  readonly observedCount: number;
  readonly confidence: "high" | "medium" | "low";
  readonly suggestion: "intent-link" | "constraint" | "observe-more";
}
```

**발견 로직:**

```
1. CoOccurrence 데이터에서 coOccurrenceRate = count / totalSourceCount
2. 판정:
   rate ≥ 0.95 + count ≥ 1000  → high confidence → intent-link 추천
   rate ≥ 0.80 + count ≥ 500   → medium → constraint 추천
   나머지                       → low → observe-more
3. 이미 IntentLink가 있는 쌍은 제외
4. 결과를 Observation 노드로 DKG에 기록
```

### 인과 → IntentLink 고정

```
발견: login → token_refresh (rate 0.98, count 15420)
  ↓
Observation: "login 후 98% 확률로 token_refresh 발생"
  ↓ (인간 확인)
Decision: "login-token_refresh 인과 관계를 공식화"
  ↓
IntentLink: "login 후 반드시 token_refresh"
  invariant: "login 이벤트 발생 후 60초 내 token_refresh 필수"
  ↓
constraint check에서 이 invariant 위반 감지 가능
```

---

## 4. SimplificationAdvisor — 최소 가짓수 유지

### 목적

prefix가 로직을 유지하면서 최소 가짓수를 유지하도록 돕는다. 미사용 차원, 저사용 entry, 과도한 주소 공간을 감지한다.

```typescript
interface SimplificationCandidate {
  readonly prefix: string;
  readonly addressSpaceSize: number;
  readonly activeAddressCount: number;
  readonly utilizationRate: number;  // active / total

  /** 미사용 차원 (모든 관측에서 단일 값만 사용) */
  readonly singleValueDims: readonly { dim: string; value: string }[];

  /** 저사용 entry (사용률 5% 미만) */
  readonly lowUsageEntries: readonly { axis: string; entry: string; usageRate: number }[];

  /** 제안 */
  readonly suggestions: readonly SimplificationSuggestion[];
}

type SimplificationSuggestion =
  | { kind: "remove-dim"; dim: string; reason: string }
  | { kind: "deactivate-entry"; axis: string; entry: string; reason: string }
  | { kind: "split-prefix"; newPrefixes: string[]; reason: string }
  | { kind: "ok"; reason: string };
```

**분석 로직:**

```
1. entryUsage에서 각 축의 entry별 사용 빈도 집계
2. addressUsage에서 prefix의 주소 공간 사용률 계산
3. 판정:
   - 차원의 모든 관측이 단일 값 → remove-dim 후보
   - entry 사용률 < 5% → deactivate 후보
   - 주소 공간 사용률 < 10% → 과도한 headroom → review
   - prefix의 차원 수 > 6 → 복잡도 경고 → split 후보
```

---

## 5. BoundaryRecommender — 경계 추천

### 목적

새 prefix가 필요한 시점과 위치를 추천한다. 기존 prefix의 복잡도 증가, 새로운 관측 패턴, 도메인 경계 변화를 감지한다.

```typescript
interface BoundaryRecommendation {
  readonly reason: string;
  readonly suggestedDomain: string | null;
  readonly suggestedDims: readonly string[];
  readonly relatedPrefixes: readonly {
    id: string;
    relation: "extends" | "splits-from" | "independent";
  }[];
  readonly estimatedCapacity: number;
  readonly confidence: "high" | "medium" | "low";
}
```

**추천 로직:**

```
1. SimplificationAdvisor에서 split-prefix 후보가 있으면 → splits-from 추천
2. CausalDiscovery에서 기존 prefix에 없는 새 패턴이 발견되면 → extends 추천
3. 새 Observation이 기존 어떤 prefix에도 매핑되지 않으면 → independent 추천
4. 추천 시 DKG의 Domain 노드를 확인하여 적절한 바운더리 제안
```

---

## 수렴 사이클

5개 서비스가 결합하여 형성하는 수렴 사이클:

```
관측 데이터 수집 (qa-sdk)
       │
       ▼
  CausalDiscovery        → 인과 후보
  SymbolComparator       → 중복 후보
  SimplificationAdvisor  → 단순화 후보
  BoundaryRecommender    → 경계 추천
       │
       ▼
  Observation 노드 (DKG에 기록)
       │
       ▼
  DecisionComparator     → 기존 결정과 충돌 검사
       │
       ▼
  Decision scaffold      → 인간 검토
       │
       ▼
  propagation pipeline   → publish → seal → activate
       │
       ▼
  닫힌 세계에 반영        → 좌표 고정 → DB SSOT
       │
       ▼
  새 관측 시작            → 수렴 여부 확인
```

**한 사이클의 결과:**
- 중복 심볼이 병합되어 가짓수가 줄어든다
- 인과 관계가 IntentLink로 고정되어 추적 가능해진다
- 미사용 entry가 비활성화되어 주소 공간이 정리된다
- 복잡해진 prefix가 분할되어 바운더리가 명확해진다
- 새로운 패턴이 새 prefix로 고정되어 좌표 체계가 확장된다

**반복할수록 시스템이 수렴한다:** 같은 의미가 같은 심볼로, 관련된 것이 같은 prefix로, 독립적인 것이 별도 바운더리로 정리된다.

---

## DSS 패러다임 대응

| DSS 개념 | 수렴 레이어 대응 |
|---|---|
| 도메인 특화 모듈 | 각 prefix = 도메인 특화 좌표 공간 |
| 기호적 추상화 | 모든 개념 = 고유 정수 (좌표 인코딩) |
| 신경기호 검증 | CausalDiscovery(패턴) + SymbolComparator(기호 비교) = 검증된 추천 |
| 오케스트레이터 | BoundaryRecommender가 prefix 라우팅 결정 |
| 엣지 배포 | decode-service가 prefix별 독립 번들로 엣지 배포 |
| 모델 사회 | Domain → prefix 그룹 → Consumer 네트워크 |

---

## 불변식

1. **수렴 레이어는 읽기 전용이다.** 그래프/좌표를 직접 수정하지 않는다. Observation을 생성할 뿐이다.
2. **병합 결정은 인간이 한다.** merge 추천은 자동, 실행은 Decision → propagation 경로.
3. **인과 관계는 통계적 후보다.** high confidence여도 IntentLink 고정은 인간 확인 후.
4. **단순화는 로직 보존이 전제다.** remove-dim은 해당 차원이 정말 단일 값만 쓰일 때만.
5. **경계 추천의 estimatedCapacity는 참고값이다.** 실제 capacity는 Decision에서 결정.

---

## 구현 매핑

| 스펙 서비스 | 구현 파일 | 주요 함수 |
|---|---|---|
| SymbolComparator | `convergence/symbol-comparator.ts` | `compareAxes`, `comparePrefixes`, `scanAxisOverlaps` |
| DecisionComparator | `convergence/decision-comparator.ts` | `compareDecisions`, `scanDecisionConflicts` |
| CausalDiscovery | `convergence/causal-discovery.ts` | `discoverCausality`, `discoverCausalityWithObservations` |
| SimplificationAdvisor | `convergence/simplification-advisor.ts` | `analyzeSimplification`, `scanAllSimplifications` |
| BoundaryRecommender | `convergence/boundary-recommender.ts` | `recommendFromSimplification`, `recommendFromCausality`, `recommendAll` |
| 수렴 사이클 오케스트레이터 | `convergence/convergence-runner.ts` | `runConvergenceAnalysis` |

export: `@qa-sdk/spec-core/analysis`

---

## SchemaValidator as Prefix Consumer

스키마 검증을 prefix 인프라를 소비하는 유틸리티로 전환.

| 구성 요소 | 파일 | 역할 |
|---|---|---|
| `schema_validation` prefix | DEMO_CATALOG | `svc_ref × validation_layer × constraint_rule × verdict_result` 좌표 |
| `schema-validation-codec.ts` | spec-core/schema | ValidationResult → prefix 좌표 매핑 |
| `schema-observation-bridge.ts` | spec-core/schema | 검증 결과 → ObservationNode 변환 |
| `schema-health-audit.ts` | spec-core/schema | 전체 prefix category 규칙 감사 |
| `metric:schema:violations` | metric-registry | 자동 수집 메트릭 |
| `skill-schema-health-audit` | DKG skill | system-health-chain 의존 |
| Profile API | registry-service | prefix/axis 단위 PATCH (blob 교체 → 프로필 패치) |

`inferCategory()`: `meta.category` 우선 → 구조 추론 fallback. category-rules event 규칙: `*_action`, `*_result`, `event_name` 축 인정.
