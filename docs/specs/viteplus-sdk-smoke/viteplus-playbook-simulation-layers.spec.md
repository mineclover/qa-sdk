---
def:
  id: viteplus-playbook-simulation-layers
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, testing, structural]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-scope-nesting
      type: depends_on
    - target: viteplus-playbook-state-transition
      type: depends_on
    - target: pipe-simulate
      type: depends_on
    - target: meta-semantic-test-tracking
      type: depends_on
    - target: pipe-gate
      type: depends_on
---

# Vite+ Playbook 시뮬레이션 계층 정의

## 목적 ^purpose

context-action 패턴의 검증을 4개 계층으로 분리하고, 각 계층의 범위·입출력·조합 방법을 고정한다. Cross-Loop 피드백 아키텍처의 guard 의존 순서를 시뮬레이션 계층에 반영한다.

## 정의 ^defines

- **4계층 시뮬레이션 모델** — 운영 상태 제약(L0) → 정적 구조(L1) → 상태 전이(L2) → 동적 경로(L3)
- **L0 guard 주입** — GateEngine/GateState/하네스 상태를 resolver 패턴으로 시뮬레이션에 주입
- **계층 간 연결** — L0 제약 → L1 유효 → L2 전이 가능 → L3 경로 시뮬 가능

## 소비 ^consumes

- `validateScopeNesting()` — L1 정적 구조 검증 (`@qa-sdk/core`)
- `transition()` / `verifyInvariants()` — L2 상태 전이 검증 (`@qa-sdk/core`)
- `simulate()` / `matchHappyPath()` — L3 동적 경로 검증 (`@qa-sdk/core`)

## 4계층 모델

```
L3  동적 경로      simulate(handlerGraph) → pipeTrace, facetTrace
    │              30종 PipeFlow 경로 추적. handlers 계층 내부.
    │
L2  상태 전이      transition(status, trigger) → next + sideEffects
    │              PlaybookStatus 6상태 전이. 단일 scope 런타임.
    │
L1  정적 구조      validateScopeNesting(nesting) → valid + issues
    │              contract descent 정합성. 전체 scope 구조.
    │
L0  운영 상태 제약  guards: isEncodable, gateResult, harnessState
                   GateEngine/GateState/하네스 상태 → L1~L3의 전제 조건.
                   선택적 주입 — 미주입 시 기본 허용 (fail-open).
```

## L0: 운영 상태 제약 (guard 주입)

Cross-Loop 브릿지가 전이 체계 간 명시적 의존을 형성한다:

| 브릿지 | 연결 | 시뮬레이션 영향 |
|---|---|---|
| ⑥→① Infra→User | `gateFilterRanges("encodable")` | inactive 주소 → L3에서 해당 pipe skip |
| ③→② Gate→Harness | BundleState complete → convention compliant | L2 전이의 guard |
| ②→⑤ Harness→Decision | 하네스 상태 → context 주입 | L2 전이의 context |

### Guard 인터페이스

simulate()의 resolver 패턴과 동일하게 선택적 주입:

```typescript
interface SimulationGuards {
  /** 주소가 encode 가능한가 — GateEngine 4-state */
  isEncodable?: (prefixId: string) => boolean;
  /** 품질 게이트 결과 — GateState 9종 */
  gateResult?: (gateId: string) => "pass" | "fail" | "review";
  /** 하네스 머신 상태 */
  harnessState?: (machineId: string) => string;
}
```

미주입 시 기본값: 모두 허용 (fail-open 원칙 준수).

### L0 → L1 연결

GateEngine에서 inactive인 주소의 scope는 contract 제공 불가:

```
isEncodable("logging-prefix") === false
  → qa-bridge scope의 logging-session 계약이 실질적으로 비활성
  → L1 validateScopeNesting()은 구조적으로 유효하지만 런타임에서 계약 불이행
```

### L0 → L2 연결

GateState가 fail이면 convention compliant 전이 불가:

```
gateResult("quality-gate") === "fail"
  → convention compliant 전이 guard 미충족
  → L2 전이 차단
```

### L0 → L3 연결

inactive 주소의 pipe는 이벤트 생산 불가:

```
isEncodable("cart_event") === false
  → simulate()에서 해당 pipe의 emit step이 skip
  → producedEvents에서 제외
```

## L1: 정적 구조 (scope-nesting)

| 검증 대상 | 도구 | 성격 |
|---|---|---|
| 계약 하향 정합성 | `validateScopeNesting()` | 정적 |
| 순서 교환 안전성 | `checkSwapSafety()` | 정적 |
| provider-stack 순서 제약 4종 | scope 제거/재배치 | 정적 |
| boundary↔scope 패싯 일관성 | facets 필드 대조 | 정적 |

## L2: 상태 전이 (state machine)

| 검증 대상 | 도구 | 성격 |
|---|---|---|
| 전이 6종 | `transition()` | 단위 |
| 부수효과 | `TransitionResult.sideEffects` | 단위 |
| 불변량 3종 | `verifyInvariants()` | 전수 |

## L3: 동적 경로 (pipe simulate)

| 검증 대상 | 도구 | 성격 |
|---|---|---|
| handler 실행 순서 | `simulate()` → `pipeTrace` | 동적 |
| 패싯 실행 순서 | `simulate()` → `facetTrace` | 동적 |
| happy path 일치 | `matchHappyPath()` | 비교 |
| 이벤트 생산 | `simulate()` → `producedEvents` | 동적 |

## 계층 간 연결

### 전체 검증 시퀀스

```typescript
// 0. 운영 상태 제약 확인
const guards: SimulationGuards = {
  isEncodable: (prefix) => gateEngine.getState(prefix) === "active",
  gateResult: (gate) => gateStates.get(gate) ?? "pass",
};

// 1. 구조가 유효한가?
const nesting = validateScopeNesting(playbookNesting);
assert(nesting.valid);

// 2. 상태 전이가 올바른가?
const submitTransition = transition("editing", "valid-submit");
assert(!isViolation(submitTransition));

// 3. handler 경로가 의도와 일치하는가?
const sim = simulate({
  graph: handlerGraph,
  initialEvent: { eventKey: "form_submit" },
  // L0 guard를 filterResolver로 연결
  filterResolver: (condition, ctx) => {
    if (condition.startsWith("gate:")) {
      return guards.gateResult?.(condition.slice(5)) !== "fail";
    }
    return true;
  },
});
assert(sim.status === "complete");
```

### guard 의존 순서 (Cross-Loop)

```
Decision success (⑤)
  → Doc approved (미결 — 별도 스펙 검토 필요)
    → Gate complete (③ GateState → L0 gateResult)
      → Convention compliant (② 하네스 → L0 harnessState)
        → encode 가능 (⑥→① GateEngine → L0 isEncodable)
          → 이벤트 생산 (① PipeFlow → L3 simulate)
```

## doc lifecycle — L0 guard에서 제외

doc lifecycle(draft/review/approved/deprecated)은 L0 guard에 포함하지 않는다.

**이유:** 외부 요인(문서 관리 상태)이 코드 검증에 직접 영향을 주면 시뮬레이션 안정성이 떨어진다. 시뮬레이션은 런타임 코드 경로 검증으로 한정.

**향후:** doc lifecycle이 런타임에 영향 주는 구체적 경로가 특정되면, 별도 스펙에서 해당 경로만 guard로 추출. guard 인터페이스가 교체 가능하게 설계되어 있으므로 추가 시 기존 코드 변경 없음.

## 관련 소스

| 계층 | 구현 | 테스트 |
|------|------|--------|
| L0 | `core/src/scope-nesting.ts` (SimulationGuards, resolveGuards) | `scope-nesting.test.ts` L0 guard 5건 |
| L1 | `core/src/scope-nesting.ts` (validateScopeNesting) | `scope-nesting.test.ts` 14건 |
| L2 | `core/src/scope-nesting-state.ts` | `scope-nesting-state.test.ts` 18건 |
| L3 | `core/src/pipe/pipe-simulate.ts` | `pipe-simulate.test.ts` 39건 |
| 통합 | — | `scope-nesting-simulate.test.ts` 13건 |
