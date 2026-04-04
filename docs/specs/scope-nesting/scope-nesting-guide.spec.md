---
def:
  id: scope-nesting-guide
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [frontend, structural, testing]
  links:
    - target: scope-nesting-system
      type: refines
    - target: viteplus-playbook-provider-stack
      type: refines
    - target: viteplus-playbook-boundary-relation
      type: depends_on
    - target: ms-concept-contract-descent
      type: implements
    - target: ms-concept-boundary
      type: implements
---

# Vite+ Playbook Scope Nesting 가이드

## 목적 ^purpose

provider stack의 순서 규칙을 contract descent로 모델링하고, `validateScopeNesting()`으로 정합성을 기계적으로 검증하는 방법을 고정한다.

## 정의 ^defines

- **ScopeContract** — scope가 소유하는 계약 선언 (provides/consumes)
- **ScopeNesting** — scope 중첩 순서 (외부→내부)
- **계약 하향 규칙** — 하위가 소비하는 계약의 제공자가 반드시 상위(조상)에 존재해야 한다

## 소비 ^consumes

- `validateScopeNesting()` — 계약 하향 정합성 검증 (`@qa-sdk/core`)
- `checkSwapSafety()` — 스코프 순서 교환 안전성 검사 (`@qa-sdk/core`)
- `Boundary` 개념 — 패싯이 존재하는 검증 가능 기능 단위 (`ms-concept-boundary`)
- `Contract Descent` — 계약은 상위→하위, 상호 무지 (`ms-concept-contract-descent`)

## 계약 선언

각 boundary scope가 provides/consumes하는 계약:

| scope | provides | consumes |
|-------|----------|----------|
| qa-bridge | `logging-session` (logging) | — |
| feature-context | `playbook-state` (state), `persist-adapter` (persist) | `logging-session` |
| handlers | `submission-handlers` (adapter) | `playbook-state`, `logging-session` |
| view | — | `playbook-state`, `submission-handlers` |

## 계약 하향 경로

```
logging-session:   qa-bridge(0) → feature-context(1), handlers(2)
playbook-state:    feature-context(1) → handlers(2), view(3)
persist-adapter:   feature-context(1) → (미소비)
submission-handlers: handlers(2) → view(3)
```

괄호 안 숫자는 nesting depth. 화살표 뒤가 소비자. 모든 소비자의 depth가 provider보다 크면 유효.

## 검증 방법

```typescript
import { validateScopeNesting, type ScopeNesting } from "@qa-sdk/core";

const nesting: ScopeNesting = {
  nestingId: "viteplus-playbook",
  scopes: [
    { scopeId: "qa-bridge", provides: [...], consumes: [] },
    { scopeId: "feature-context", provides: [...], consumes: [...] },
    { scopeId: "handlers", provides: [...], consumes: [...] },
    { scopeId: "view", provides: [], consumes: [...] },
  ],
};

const result = validateScopeNesting(nesting);
// result.valid === true → 계약 하향 성립
// result.descentPaths → 계약별 provider→consumer 경로
// result.issues → error/warning 목록
```

## 검증 규칙

### L0 guard 주입

```typescript
import { validateScopeNesting, type SimulationGuards } from "@qa-sdk/core";

const guards: SimulationGuards = {
  isEncodable: (contractId) => gateEngine.isActive(contractId),
  // gateResult, harnessState는 미주입 시 기본 허용 (fail-open)
};

const result = validateScopeNesting(nesting, guards);
// guard-inactive warning → 비활성 계약
// missing-provider error → 비활성 계약을 소비하는 하위 scope
```

## 검증 규칙

| 코드 | severity | 의미 |
|------|----------|------|
| `missing-provider` | error | 소비하는 계약의 제공자가 상위에 없음 (순서 위반 포함) |
| `self-consume` | error | 자기가 제공한 계약을 자기가 소비 |
| `duplicate-provider` | warning | 동일 계약을 복수 scope가 제공 |
| `unused-contract` | warning | 제공하지만 하위에서 소비하지 않음 |
| `empty-scope` | warning | provides도 consumes도 없는 scope |
| `guard-inactive` | warning | L0 guard에 의해 계약 비활성 (encode 불가) |
| `optional-missing` | warning | optional consume(required: false)의 provider 부재 — fallback 동작 |
| `override-no-parent` | warning | override 선언했지만 상위에 대체 대상 없음 |

## 순서 교환 안전성 검사

새 scope 추가나 순서 변경 시 기존 계약이 깨지는지 사전 검사:

```typescript
import { checkSwapSafety } from "@qa-sdk/core";

const errors = checkSwapSafety(nesting, 0, 1); // qa-bridge ↔ feature-context
// errors !== null → 교환 시 계약 깨짐
// errors === null → 교환 안전
```

## 새 scope 추가 가이드

1. 새 scope가 제공하는 계약과 소비하는 계약을 선언
2. 소비하는 계약의 provider가 상위에 있는 위치에 삽입
3. `validateScopeNesting()` 실행하여 정합성 확인
4. `checkSwapSafety()`로 기존 scope와의 순서 교환 가능 여부 확인

## handlers 계층 PipeSpec 연결

scope-nesting은 구조 검증 (정적). handlers 내부의 비즈니스 흐름은 PipeSpec simulate로 검증 (동적).

```typescript
// 1단계: 구조 검증
const nestingResult = validateScopeNesting(nesting);
assert(nestingResult.valid);

// 2단계: 흐름 검증 (handlers 내부만)
const simResult = simulate({ graph: handlerGraph, initialEvent: { eventKey: "form_submit" } });
assert(simResult.status === "complete");

const happyPath = matchHappyPath(simResult, {
  expectedPipeTrace: ["validate-input", "compute-result", "log-event"],
});
assert(happyPath.match);
```

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/scope-nesting.ts` | 타입 + guard + validate + resolve |
| `core/src/scope-nesting.test.ts` | 단위 테스트 (32건) |
| `core/src/scope-nesting-mount.ts` | mount flow 검증 |
| `core/src/scope-nesting-mount.test.ts` | mount flow 테스트 (9건) |
| `core/src/scope-nesting-timing.ts` | 계약 시점 분석 |
| `core/src/scope-nesting-timing.test.ts` | timing 테스트 (6건) |
| `core/src/scope-nesting-state.ts` | 상태 전이 검증 |
| `core/src/scope-nesting-state.test.ts` | 전이 테스트 (21건) |
| `core/src/scope-nesting-simulate.test.ts` | 통합 테스트 (13건) |
