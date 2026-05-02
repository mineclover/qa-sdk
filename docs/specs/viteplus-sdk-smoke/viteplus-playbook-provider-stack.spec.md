---
def:
  tier: component
  id: viteplus-playbook-provider-stack
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, observability]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-template-implementation
      type: depends_on
    - target: ms-concept-contract-descent
      type: implements
---

# Vite+ Playbook Provider Stack

## 목적 ^purpose

context-action의 provider 선언 순서가 의미를 가지는 구조를 Vite+ canonical example에 맞는 조립 순서로 고정한다.

## 정의 ^defines

- **provider composition order** — Page Root → qa-bridge → feature context → handlers/actions → view render 의 5단계 조립 순서 규칙
- **scope nesting = contract descent 구현** — 각 scope가 계약을 소유하고, 상위→하위로 하향 전파. 순서 위반 시 하위가 소비할 계약이 부재

## 소비 ^consumes

- `validateScopeNesting` — 계약 하향 정합성 검증 (`@qa-sdk/core`)
- `qa-bridge` facade — session/trace/logging 경계 (`viteplus-playbook-template-implementation`)
- `playbookStore` / `playbookPersist` — feature context의 store/refs (`viteplus-playbook-template-implementation`)
- `playbookHandlers` — handler/action binding (`viteplus-playbook-template-implementation`)
- `playbookDom` — view 렌더링 helper (`viteplus-playbook-template-implementation`)

## 구성 ^overview

- 이 문서는 React provider 자체를 기술하는 것이 아니라, 같은 의미의 composition order를 정의한다.
- 상위가 하위를 감싸는 순서가 깨지면 최신 상태 접근, focus 이동, logging flush가 어긋난다.

## provider/composition 순서

1. **Page Root**
   브라우저 진입점과 feature mount를 시작한다.
2. **qa-bridge facade**
   session, trace, debug envelope flush 경계를 먼저 연다.
3. **feature context**
   store, refs, async submitter를 묶어 business/handler가 읽을 경계를 만든다.
4. **handlers/actions binding**
   현재 context 위에서 orchestration과 dispatch adapter를 등록한다.
5. **view render**
   입력 전달과 상태 표현만 수행한다.

## 순서 제약

- `qa-bridge`가 없으면 handler가 logging side effect를 수행할 수 없다.
- `feature context`가 없으면 handler와 view가 같은 state/ref를 공유할 수 없다.
- handler/action binding은 context 이후여야 한다.
- view는 가장 마지막에 와야 한다.

## scope/aspect 배정 이유

- `scope: flow`
  핵심은 “무엇이 먼저/나중에 구성되는가”라는 순서다.
- `aspect: process_flow`
  provider stack은 데이터 모델이나 상태 모델이 아니라 구성 절차의 흐름이다.
