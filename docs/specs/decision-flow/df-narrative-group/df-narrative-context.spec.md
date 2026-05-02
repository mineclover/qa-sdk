---
def:
  tier: component
  id: df-narrative-context
  type: spec
  address: def_document:v2:68757
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-narrative-structure
      type: traces_to
---
# Decision Flow — ContextProvider

## 목적 ^purpose

ContextProvider — 결정 시작 시 이전 맥락을 표면화하여 같은 조사를 반복하지 않게 만드는 기능. 컨텍스트가 쌓일수록 다음 결정이 쉬워진다.

## 구성 ^overview

- **provide()**: 스키마 기준 이력 요약, 패턴 힌트, 정책 힌트, 인지 모델 힌트, 열린 질문 5가지를 표면화
- **provideForGate()**: 특정 gate의 이전 선택 분포(비율)까지 추가 제공
- **축적 사이클**: 결정 1건마다 이력이 쌓이고, 5건 이후 패턴 감지 및 매칭 자동 활성화
- **계층적 컨텍스트**: assembleHierarchicalContext()로 도메인→DSL→prefix→dim→entry 5레벨 구조 정보를 한 번에 조합
- **통합 지점**: catalog, DKG, GateEngine, decode, registry, convergence, spec-core, ContextProvider 8곳의 구조 정보를 결정 시점에 병합
- **비강제 원칙**: 컨텍스트를 무시하고 결정해도 무방 — 시스템은 맥락을 보여줄 뿐
- **핵심 가치**: 기록이 아닌 컨텍스트 제공 — 과거가 미래의 결정을 쉽게 만드는 좌표계

---

## ContextProvider API ^api

`context-provider.ts`의 `ContextProvider` 클래스.

### 생성

```ts
interface ContextProviderDeps {
  readonly store: InstanceStore;
  readonly policies: ReadonlyMap<string, readonly FlowPolicy[]>;   // schemaId → policies
  readonly schemas: ReadonlyMap<string, FlowSchema>;                // schemaId → schema
  readonly mentalModels?: ReadonlyMap<string, { question: string }>; // modelId → question
}

const provider = new ContextProvider(deps);
```

### provide(schemaId, context?)

결정 시작 시 전체 컨텍스트를 반환한다.

```ts
interface DecisionContext {
  readonly history: HistorySummary;           // 이전 결정 이력 요약
  readonly patterns: readonly PatternHint[];  // 감지된 반복 패턴
  readonly activePolicies: readonly PolicyHint[];  // 적용 가능한 자동 정책
  readonly modelHints: readonly ModelHint[];   // 인지 모델 힌트
  readonly openQuestions: readonly string[];   // 열린 질문 (최근 5건에서 추출)
}
```

- `history.mostCommonPath`: 가장 빈번한 gate 선택 경로
- `patterns`: `detectPatterns(store, schemaId, { minFrequency: 3 })` 상위 5건
- `patterns[].matchesCurrent`: 현재 context의 key/value와 패턴의 contextKey/contextValue 일치 여부

### provideForGate(schemaId, gateId, context?)

특정 gate에 도달했을 때 해당 gate의 상세 컨텍스트를 반환한다.

```ts
interface GateContext {
  readonly gateId: string;
  readonly gateName: string;
  readonly isCore: boolean;
  readonly branchDistribution: readonly { branchId: string; count: number; ratio: number }[];
  readonly modelHints: readonly ModelHint[];
  readonly autoPolicy?: { name: string; branchId: string; rationale: string };
  readonly previousChoiceCount: number;
}
```

- `branchDistribution`: 완료된 인스턴스에서 해당 gate의 branch 선택 분포 (count 내림차순)

### lookup(query)

키워드로 관련 결정 이력, 정책, 패턴을 종합 조회한다. 결정 전 "이미 무엇을 알고 있는가" 확인용.

```ts
interface FeatureLookup {
  readonly query: string;
  readonly relatedInstances: readonly FeatureInstance[];  // 최신순 정렬
  readonly relatedPolicies: readonly FlowPolicy[];
  readonly relatedPatterns: readonly PatternHint[];
  readonly lastDecision?: FeatureInstance;
  readonly openQuestions: readonly string[];
}
```

- 검색 범위: 모든 스키마의 인스턴스 context 값 + schemaId + 정책 name/rationale
- FeatureInstance.summary: 코어 gate 선택 요약 (`"scope=extend, integration=integrated"`)

## assembleHierarchicalContext API ^hierarchical-api

`hierarchical-context.ts`의 `assembleHierarchicalContext(prefixId, source)` 함수.

5개 레벨을 수직으로 관통하여 정제된 맥락을 조합한다.

### 입력: HierarchySource

```ts
interface HierarchySource {
  readonly domains: readonly DomainInfo[];
  readonly dslBundles: readonly DslBundleInfo[];
  readonly prefixes: ReadonlyMap<string, PrefixInfo>;
  readonly axes: ReadonlyMap<string, DimInfo>;
}
```

### 출력: HierarchicalContext

| 필드 | 레벨 | 설명 |
|------|------|------|
| `domain` | L1 | 소속 도메인 — 공유 축, 경계(exports/internal) |
| `dslBundles` | L2 | 소속 DSL 번들 (복수 가능) — fixedDims, invariants |
| `prefix` | L3 | prefix 자체 — dims, category, totalSpace |
| `dimensions` | L4-5 | 차원별 entries, capacity, headroom (axis kind만) |
| `constraints` | 조합 | 도메인 경계 + DSL 불변조건 + headroom 경고 |
| `sharedAxes` | 조합 | 도메인 sharedAxes + DSL fixedDims 합집합 |
| `summary` | - | 한 줄 요약 (`"prefixId | 도메인:X | DSL:[Y,Z] | N차원 | 총headroom:M"`) |

### assembleMultiPrefixContext

`assembleMultiPrefixContext(prefixIds, source)` — 여러 prefix의 계층 컨텍스트를 한 번에 조합. 결정에 관련된 prefix가 복수일 때 사용.

---

## 관련 소스

증명 코드: `packages/decision-flow/src/proof.test.ts` (125 tests)

## 장 8: 시스템의 역할은 결정을 쉽게 만드는 것이다

### 질문

이 시스템이 결정을 **더 어렵게** 만들고 있지 않은가?
기록, 추적, 모니터링, 알림 — 이 모든 것이 관료주의가 아닌가?

### 증명

`ContextProvider`를 구현했다.
결정을 시작할 때 `provide(schemaId, context)`를 호출하면:

1. **이력 요약**: 이 스키마에서 이전에 몇 번 결정했고, 보통 어떤 경로를 선택했고, 평균 confidence는 얼마였는가
2. **패턴 힌트**: "team=platform일 때, extend → fast 경로를 5회 선택" — 그리고 **현재 컨텍스트와 매치되는지** 표시
3. **정책 힌트**: "이 조건이면 자동으로 extend가 선택된다" — 이미 자동화된 것을 알려줌
4. **인지 모델 힌트**: "이 gate에서는 이 질문을 생각해보라" — bezos-doors: "되돌릴 수 있는가?"
5. **열린 질문**: 이전 결정에서 남긴 미해결 질문

`provideForGate()`를 호출하면 특정 gate의 이전 선택 분포까지 제공:
"scope gate에서 extend 75%, new 25%. 코어 gate임."

### 축적 사이클 검증

- 1회차: 컨텍스트 없음 (처음이니까)
- 1건 결정 후: 이력 1건
- 5건 결정 후: 이력 5건 + 패턴 감지 + 매칭
- **결정할수록 다음 결정의 컨텍스트가 풍부해진다**

강제하지 않는다. 컨텍스트를 무시하고 결정해도 된다. 시스템은 "이런 맥락이 있다"고 보여줄 뿐.

### 결론

**시스템의 핵심 역할은 기록이 아니라 컨텍스트 제공이다.**

기록, 모니터링, 알림은 부산물이다. 진짜 가치는:
- 사람에게: 이전 맥락이 자동으로 표면화되므로 **같은 조사를 반복하지 않아도 된다**
- 시스템에게: 일관된 축으로 축적하므로 **컨텍스트가 흩어지지 않는다**

```
컨텍스트 축적 → 표면화 → 쉬운 결정 → 결과가 다시 축적
```

이것이 단순한 "의사결정 기록 시스템"과 "의사결정 좌표계"의 차이다.
기록 시스템은 과거를 보관한다. 좌표계는 과거가 미래의 결정을 쉽게 만든다.

---

## 장 9: 시스템 구조를 관통하여 맥락을 조합한다

### 질문

decision-flow는 독립 모듈인가, 아니면 시스템 전체의 통합 지점인가?

구조 정보는 8곳에 흩어져 있다:
catalog, DKG, GateEngine, decode, registry, convergence, spec-core, ContextProvider.
이것들이 결정 시점에 하나로 합쳐지는가?

### 증명

`assembleHierarchicalContext("cart_event")`를 호출하면 5개 레벨에서 맥락이 조합된다:

```
Level 1 — Domain: event-domain
  공유 축: [order_status, order_action]
  경계: exports=[order_status, auth_state]

Level 2 — DSL: dsl-checkout, dsl-commerce (2개 번들에 소속)
  불변조건: "checkout page_view 없이 flow_point(success) 관측되면 안 됨"
  불변조건: "주문 금액은 0보다 커야 함"

Level 3 — Prefix: cart_event (category: event)
  dims: order_status(axis), order_action(axis), svc_ref(prefix_ref)

Level 4-5 — Dim/Entry:
  order_status: [pending,confirmed,shipped,delivered,cancelled] capacity:8 headroom:3
  order_action: [add_to_cart,remove,update_quantity,checkout,cancel] capacity:8 headroom:3

조합된 제약: 도메인 경계 + DSL 불변조건 + headroom 경고
조합된 공유 축: [order_action, order_status, svc_ref]
요약: "cart_event | 도메인:event-domain | DSL:[dsl-checkout,dsl-commerce] | 3차원 | 총headroom:6"
```

page_view에서는 다른 맥락이 조합됨:
- observation-domain 소속
- user_type headroom=1 경고 자동 포함
- dsl-checkout 공유 (cart_event와 같은 파이프라인)

복수 prefix를 한 번에 조합하면 교차점(공유 DSL)도 보임.

### 결론

**decision-flow는 독립 모듈이 아니라 시스템 구조의 통합 지점이다.**

구조 정보가 5개 레벨에 흩어져 있어도, `assembleHierarchicalContext()` 한 번으로
도메인 경계, DSL 불변조건, 차원 headroom까지 한 번에 표면화된다.

이것이 "사람에게는 쉬운 의사결정"의 실체다:
- 직접 catalog/DKG/spec-core를 뒤질 필요 없이
- 결정할 prefix의 이름만 넣으면
- 관련된 모든 제약과 여유가 한 번에 보인다
