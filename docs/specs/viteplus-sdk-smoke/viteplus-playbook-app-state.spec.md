---
def:
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
    - target: viteplus-playbook-template-implementation
      type: depends_on
    - target: trace-context-spec
      type: depends_on
---

# Vite+ Playbook App State

## 목적 ^purpose

playbook feature가 공통으로 가지는 프론트엔드 상태 모델을 정의해, context 분리와 spec boundary 분리가 같은 상태 좌표 위에서 읽히도록 만든다.

## 구성 ^overview

- 공통 state slot은 `draft`, `validationIssues`, `result`, `status`, `activity`, `debugRevision`, `submissionError`, `lastSubmittedAt` 이다.
- `status`는 shared playbook state machine의 `idle/editing/invalid/submitting/success/error`를 따른다.
- `activity`와 `debugRevision`은 UI에 보이는 값이면서 logging flush와 함께 변하는 app state다.

## 상태 슬롯

| 슬롯 | 의미 |
|------|------|
| `draft` | 현재 편집 중인 feature 입력 |
| `validationIssues` | 현재 submit 기준의 field issue 목록 |
| `result` | business 계산 결과 |
| `status` | 공통 상태 머신 값 |
| `activity` | handler가 append하는 사용자 가시 이벤트 로그 |
| `debugRevision` | NoopTransport flush 이후 UI 갱신 트리거 |
| `submissionError` | async submit 실패 메시지 |
| `lastSubmittedAt` | 마지막 성공 제출 시각 |

## 전이 규칙

- draft 변경 → `editing`
- invalid submit → `invalid`
- valid submit 시작 → `submitting`
- submit 성공 → `success`
- submit 실패 → `error`
- reset → `idle`

## scope/aspect 배정 이유

- `scope: state`
  문서의 중심은 feature가 들고 있는 런타임 값과 전이다.
- `aspect: app_state`
  브라우저 화면과 handler가 함께 읽고 쓰는 프론트엔드 상태이므로 domain/system이 아니라 app state다.
