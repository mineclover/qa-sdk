---
def:
  tier: component
  id: viteplus-playbook-interaction
  scope: ui
  aspect: interaction
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, accessibility, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-template-implementation
      type: depends_on
    - target: viteplus-playbook-app-state
      type: depends_on
---

# Vite+ Playbook Interaction

## 목적 ^purpose

invalid focus 이동, submit 차단, success 이후 reopen, reset 복원처럼 사용자 입력에 대한 반응 규칙을 interaction 문서로 분리한다.

## 정의 ^defines

- **invalid focus** — validation failure 시 first invalid field로 focus 이동
- **submit feedback** — submitting 동안 버튼 label 변경 + 비활성화
- **reopen** — success 이후 draft 변경 시 `editing` 복귀 + stale result 제거
- **reset** — 시각 상태와 runtime state 동시 초기화
- **debug surface** — flush 이후 recent records/latest envelope UI 반영

## 소비 ^consumes

- `playbook state shape` — status 전이 기반 반응 (`viteplus-playbook-app-state`)
- `playbookDom` — input/select/textarea 렌더링 + active-field 복원 (`viteplus-playbook-template-implementation`)

## 구성 ^overview

- interaction은 view가 렌더링하고 handler가 완성한다.
- reset은 입력값뿐 아니라 validation/result/status까지 baseline으로 돌린다.

## interaction 규칙

1. **invalid focus**
   validation failure가 발생하면 first invalid field로 focus를 이동한다.
2. **submit feedback**
   submitting 동안 버튼 label은 진행 중 상태를 보여줘야 한다.
3. **reopen**
   success 이후 draft 변경은 새 평가를 위해 `editing`으로 복귀해야 한다.
4. **reset**
   reset은 시각 상태와 runtime state를 함께 초기화해야 한다.
5. **debug surface**
   flush 이후 recent records와 latest envelope가 UI에 반영되어야 한다.

## scope/aspect 배정 이유

- `scope: ui`
  사용자가 실제로 체감하는 반응 규칙을 다룬다.
- `aspect: interaction`
  layout이나 component보다 “입력에 대한 시스템 반응”이 핵심이다.
