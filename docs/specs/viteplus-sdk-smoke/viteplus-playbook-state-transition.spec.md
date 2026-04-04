---
def:
  id: viteplus-playbook-state-transition
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-app-state
      type: refines
---

# Vite+ Playbook State Transition

## 목적 ^purpose

playbook feature의 status 전이 규칙을 고정한다. 어떤 사용자 행위가 어떤 상태 전이를 일으키는지 관리 관점에서 정의한다.

## 정의 ^defines

- **status 전이 6종** — draft 변경→editing, invalid submit→invalid, valid submit→submitting, 성공→success, 실패→error, reset→idle

## 소비 ^consumes

- `playbook state shape` — 8개 슬롯 중 `status` 필드 (`viteplus-playbook-app-state`)
- `playbookStateMachine` — 상태 머신 구현 (`viteplus-playbook-template-implementation`)

## 전이 규칙

| 트리거 | 전이 | 부수효과 |
|--------|------|----------|
| draft 변경 | → `editing` | stale result 제거 (success에서 변경 시) |
| invalid submit | → `invalid` | validationIssues 갱신, first invalid field focus |
| valid submit 시작 | → `submitting` | submit 버튼 비활성화 |
| submit 성공 | → `success` | result 갱신, lastSubmittedAt 갱신 |
| submit 실패 | → `error` | submissionError 갱신 |
| reset | → `idle` | draft/validationIssues/result/status 전부 baseline 복원 |

## 불변량

- `submitting` 상태에서 draft 변경 불가 (submit 진행 중)
- `success` → draft 변경 시 반드시 `editing`으로 복귀 (stale result 유지 금지)
- reset은 어떤 상태에서든 `idle`로 복귀 가능
