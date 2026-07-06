---
def:
  id: state-event-terminology
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, convention, observability]
  links:
    - target: architecture-revealing-code-convention
      type: refines
    - target: event-logging-lifecycle-rule
      type: traces_to
    - target: definition-state-model
      type: traces_to
    - target: responsibility-closure-harness
      type: traces_to
sources:
  - packages/definition-catalog/src/state-model.ts
  - packages/definition-catalog/src/state-model.test.ts
  - packages/definition-catalog/src/harness-tracker.ts
  - packages/definition-catalog/src/harness-machines.test.ts
  - packages/work-domain/src/gate-fsm.ts
  - packages/work-domain/src/gate-fsm.test.ts
  - packages/permission-engine/src/resource-policy/state.ts
  - packages/permission-engine/src/resource-policy/state.test.ts
  - packages/event-catalog/src/prefix-mapping.ts
---

# State/Event Terminology — 상태와 이벤트 역할 분리 규칙

## 목적 ^purpose

FSM, state model, transition, event, readiness/read model이 서로 다른 authority를 갖는다는 용어 규칙을 정의한다. 목표는 event로 상태 모델을 대체한다는 오해를 막고, 상태 전이 규칙과 전이 관측 이벤트가 중복 구현되지 않게 하는 것이다.

## 용어 ^defines

| 용어 | 소유 질문 | authority |
|------|-----------|-----------|
| state | 지금 무엇인가 | 현재 상태 값 또는 상태 snapshot |
| state model / FSM | 어떤 상태와 전이가 허용되는가 | allowed state/transition rule |
| transition | 어떤 조건에서 state가 바뀌는가 | state mutation rule 또는 pure transition function |
| event | 무엇이 발생/관측되었는가 | append-only fact, audit/evidence |
| readiness/read model | 현재 입력으로 무엇을 판단할 수 있는가 | derived projection, source mutation authority 없음 |

## 원칙

1. **FSM은 event로 대체되지 않는다.**
   Event는 상태 전이가 발생했음을 기록하거나, 전이를 유발한 사실을 표현한다. FSM은 어떤 전이가 유효한지와 현재 상태를 어떻게 갱신할지 정의한다.

2. **Event는 current state authority가 아니다.**
   Event replay로 current state를 계산할 수는 있지만, 그 경우에도 authority는 "event log + replay rule" 조합이다. 단일 event가 current state를 직접 소유하지 않는다.

3. **Read model은 write authority가 아니다.**
   Readiness, dry-run, status projection은 같은 입력을 반복 가능하게 읽기 위한 projection이다. source markdown, registry row, TODO/spec lifecycle을 직접 변경하지 않는다.

4. **State reduction은 scope-local decision이다.**
   어떤 패키지에서 FSM/readiness를 제거했다는 결정은 그 패키지 목적 단위의 단순화다. 전역적으로 FSM 사용을 금지하는 결정이 아니다.

## 사용 패턴

| 패턴 | 올바른 표현 |
|------|-------------|
| Resource lifecycle | `ResourcePolicyState`와 transition 함수가 state authority, audit event는 evidence |
| Harness machine | state-model이 transition authority, `harness.transition`은 관측 이벤트 |
| Quality gate | `transitionGate()`가 gate state authority, `gate.execution`은 실행/전이 관측 |
| Deterministic label registry | 현재는 상태 없는 projection. FSM readiness/transition dry-run은 해당 패키지 범위에서 제거 |
| Docs control-plane readiness | read-only projection. warning/dry-run은 source mutation authority가 아님 |

## Anti-pattern

- event name만 정의하고 state transition invariant를 정의하지 않는다.
- state enum과 event taxonomy가 같은 값을 중복 소유한다.
- dry-run 결과를 persisted current state처럼 해석한다.
- TODO checkbox나 PRD pass 상태를 lifecycle transition authority로 취급한다.
- "FSM 제거" 결정을 다른 도메인 상태 모델에도 일반화한다.

## 검증 ^consumes

구조 변경 시 확인한다.

```bash
corepack pnpm --filter definition-catalog exec vitest run src/state-model.test.ts src/harness-machines.test.ts
corepack pnpm --filter work-domain exec vitest run src/gate-fsm.test.ts
corepack pnpm --filter permission-engine exec vitest run src/resource-policy/state.test.ts
node packages/cli/dist/index.js def validate
```

상태 전이 코드가 있다면 최소 테스트는 다음을 포함해야 한다.

- 허용 전이
- 금지 전이
- 자기 전이 또는 역전이 정책
- 전이 side effect 또는 event/audit emission
