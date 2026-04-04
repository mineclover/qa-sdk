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
---

# Vite+ Playbook 시뮬레이션 계층 정의

## 목적 ^purpose

context-action 패턴의 검증을 3개 독립 계층으로 분리하고, 각 계층의 범위·입출력·조합 방법을 고정한다.

## 정의 ^defines

- **3계층 시뮬레이션 모델** — 정적 구조(L1) → 상태 전이(L2) → 동적 경로(L3)
- **계층 간 연결 규칙** — L1 유효 → L2 전이 가능 → L3 경로 시뮬 가능

## 소비 ^consumes

- `validateScopeNesting()` — L1 정적 구조 검증 (`@qa-sdk/core`)
- `transition()` / `verifyInvariants()` — L2 상태 전이 검증 (`@qa-sdk/core`)
- `simulate()` / `matchHappyPath()` — L3 동적 경로 검증 (`@qa-sdk/core`)

## 3계층 모델

```
L3  동적 경로      simulate(handlerGraph) → pipeTrace, facetTrace
    │              30종 PipeFlow 경로 추적. handlers 계층 내부만.
    │              입력: PipeGraph + initialEvent + resolver
    │              출력: SimulationResult (steps, trace, events)
    │
L2  상태 전이      transition(status, trigger) → next + sideEffects
    │              PlaybookStatus 6상태 전이. 단일 scope 런타임.
    │              입력: 현재 상태 + 트리거
    │              출력: 다음 상태 + 부수효과 | 위반
    │
L1  정적 구조      validateScopeNesting(nesting) → valid + issues
                   contract descent 정합성. 전체 scope 구조.
                   입력: ScopeNesting (scopes[].provides/consumes)
                   출력: NestingValidation (issues, descentPaths)
```

## 계층별 범위

### L1: 정적 구조 (scope-nesting)

| 검증 대상 | 도구 | 성격 |
|---|---|---|
| 계약 하향 정합성 | `validateScopeNesting()` | 정적 — 코드 실행 없이 구조만 검사 |
| 순서 교환 안전성 | `checkSwapSafety()` | 정적 — 가상 교환 후 재검증 |
| provider-stack 순서 제약 4종 | `validateScopeNesting()` + scope 제거/재배치 | 정적 |
| boundary↔scope 패싯 일관성 | facets 필드 대조 | 정적 |

**범위 밖**: 상태 전이, UI 반응, 비즈니스 로직

### L2: 상태 전이 (state machine)

| 검증 대상 | 도구 | 성격 |
|---|---|---|
| 전이 6종 | `transition()` | 단위 — 상태×트리거 조합 |
| 부수효과 | `TransitionResult.sideEffects` | 단위 — 전이 결과에 포함 |
| 불변량 3종 | `verifyInvariants()` | 전수 — 모든 상태×관련 트리거 |

**범위 밖**: scope 구조, PipeFlow 경로, UI DOM

### L3: 동적 경로 (pipe simulate)

| 검증 대상 | 도구 | 성격 |
|---|---|---|
| handler 실행 순서 | `simulate()` → `pipeTrace` | 동적 — 이벤트 체인 추적 |
| 패싯 실행 순서 | `simulate()` → `facetTrace` | 동적 — step별 패싯 기록 |
| happy path 일치 | `matchHappyPath()` | 비교 — 기대 trace vs 실제 trace |
| 이벤트 생산 | `simulate()` → `producedEvents` | 동적 — emit/produces 추적 |

**범위 밖**: scope 구조, 상태 전이, UI DOM

## 계층 간 연결

### L1 → L2: scope가 상태 전이의 전제 조건

scope-nesting이 유효해야 상태 전이가 의미를 가진다.
qa-bridge scope가 없으면 handler의 logging 부수효과가 불가능하므로 전이의 sideEffect가 실행 불가.

```
L1 유효(logging-session 제공) → L2 전이 시 logging 부수효과 실행 가능
L1 유효(playbook-state 제공) → L2 전이 시 state 변경 부수효과 실행 가능
```

### L2 → L3: 상태 전이가 시뮬레이션 진입 조건

valid-submit 전이가 성공해야 handler PipeGraph의 form_submit 이벤트가 트리거된다.

```
L2 transition("editing", "valid-submit") → submitting
  → L3 simulate({ initialEvent: { eventKey: "form_submit" } })
```

### L1 + L2 + L3: 전체 검증 시퀀스

```typescript
// 1. 구조가 유효한가?
const nesting = validateScopeNesting(playbookNesting);
assert(nesting.valid);

// 2. 상태 전이가 올바른가?
const submitTransition = transition("editing", "valid-submit");
assert(!isViolation(submitTransition));
assert(submitTransition.next === "submitting");

// 3. handler 경로가 의도와 일치하는가?
const sim = simulate({ graph: handlerGraph, initialEvent: { eventKey: "form_submit" } });
assert(sim.status === "complete");
const happy = matchHappyPath(sim, { expectedPipeTrace: ["validate", "compute", "log"] });
assert(happy.match);
```

## 시뮬레이션 대상이 아닌 전이 체계

| 전이 체계 | 이유 | 소속 |
|---|---|---|
| GateEngine 4-state | 정적 파생 (dim 플래그 조합) | 운영 계층 |
| GateState 9종 | 품질 게이트 실행 상태 | 운영 계층 |
| 하네스 7머신 | 시스템 운영 FSM | 관측 계층 |
| DocLifecycle 4종 | 문서 생명주기 | 관측 계층 |

이들은 `pipe-gate`, `harness`, `definition-catalog`에서 독립적으로 검증된다.
context-action 시뮬레이션과는 직교.

## 관련 소스

| 계층 | 구현 | 테스트 |
|------|------|--------|
| L1 | `core/src/scope-nesting.ts` | `scope-nesting.test.ts` (14) |
| L2 | `core/src/scope-nesting-state.ts` | `scope-nesting-state.test.ts` (18) |
| L3 | `core/src/pipe/pipe-simulate.ts` | `pipe-simulate.test.ts` (39) |
| 통합 | — | `scope-nesting-simulate.test.ts` (13) |
