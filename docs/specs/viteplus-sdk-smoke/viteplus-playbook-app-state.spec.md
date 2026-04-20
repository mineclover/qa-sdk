---
def:
  tier: component
  id: viteplus-playbook-app-state
  scope: state
  aspect: app_state
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, observability, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
---

# Vite+ Playbook App State

## 목적 ^purpose

playbook feature가 공통으로 가지는 프론트엔드 상태 모델의 shape을 정의한다.

## 정의 ^defines

- **playbook state shape** — 8개 공통 슬롯: `draft`, `validationIssues`, `result`, `status`, `activity`, `debugRevision`, `submissionError`, `lastSubmittedAt`

## 소비 ^consumes

- `playbookStore` — store/subscribe/update helper (`viteplus-playbook-template-implementation`)
- `trace-context` — session/trace 경계 (`trace-context-spec`)

## 구성 ^overview

- 전이 규칙은 `viteplus-playbook-state-transition`에서 정의한다.
- `activity`와 `debugRevision`은 UI에 보이는 값이면서 logging flush와 함께 변하는 app state다.

## 상태 슬롯

| 슬롯 | 패싯 | 의미 |
|------|------|------|
| `draft` | 정의 | 현재 편집 중인 feature 입력 |
| `validationIssues` | 관리 | 현재 submit 기준의 field issue 목록 |
| `result` | 생산 | business 계산 결과 |
| `status` | 관리 | 공통 상태 머신 값 |
| `activity` | 소비 | handler가 append하는 사용자 가시 이벤트 로그 |
| `debugRevision` | 소비 | NoopTransport flush 이후 UI 갱신 트리거 |
| `submissionError` | 관리 | async submit 실패 메시지 |
| `lastSubmittedAt` | 생산 | 마지막 성공 제출 시각 |
