---
def:
  tier: component
  id: viteplus-canonical-review-implementation
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, observability]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-template-implementation
      type: depends_on
    - target: viteplus-playbook-provider-stack
      type: depends_on
    - target: viteplus-playbook-app-state
      type: depends_on
    - target: viteplus-playbook-interaction
      type: depends_on
    - target: platform-sdk-spec
      type: depends_on
    - target: sdk-usage-guide
      type: depends_on
---

# Vite+ Canonical Review 구현

## 목적 ^purpose

Vite+ 소비처 안에서 qa-sdk logging bridge와 implementation-convention 책임 분리를 결합하는 최소 feature 구조를 구현 단위로 정리한다.

## 정의 ^defines

- `CanonicalReviewExample` — canonical review feature의 mount 진입점
- `CanonicalReviewContexts` — store, refs, async persist adapter, qa-bridge 의존성 경계
- `business/*` — draft, validation, result, activity, state machine 순수 로직
- `handlers/*` — focus 이동, flush, logging, async submit orchestration
- `actions/*` — DOM 이벤트에서 handler 호출로 바꾸는 adapter
- `hooks/getCanonicalReviewData` — 화면용 view-model 조립
- `views/CanonicalReviewView` — 실제 DOM 렌더링과 input binding

## 소비 ^consumes

- `packages/viteplus-sdk-smoke/src/qa-bridge.ts` — qa-sdk logging facade
- `@qa-sdk/sdk` `NoopTransport` — 네트워크 없는 debug envelope 검증
- `runSdkSmoke()` — 기존 Vite+ smoke surface
- `viteplus-playbook-template-implementation` — shared runtime/store/dom helper

## 구성 ^overview

- `contexts`
  `CanonicalReviewContext`는 app-local store와 ref registry를 만들고, logging/persist side effect를 handler에서만 쓰도록 감싼다.
- `business`
  `canonicalReviewValidation`, `canonicalReviewResult`, `canonicalReviewStateMachine`은 view나 bridge를 모르고 입력만으로 결과를 계산한다.
- `handlers`
  `createCanonicalReviewSubmissionHandlers`는 validation failure, focus 이동, metric/event emit, async persist, flush를 한 레이어에서 조율한다.
- `actions`
  form submit, reset, field update를 view에서 직접 business로 보내지 않고 action adapter를 거친다.
- `hooks`
  `getCanonicalReviewData`는 status label, route label, envelope preview처럼 화면 전용 파생값만 만든다.
- `views`
  `CanonicalReviewView`는 상태 문자열과 issue 메시지를 렌더링하고, 입력값 변경을 action 호출로만 전달한다.

## 구현 단위

- `contexts/CanonicalReviewContexts.ts`
  store + refs + async submitter + bridge injection
- `business/canonicalReviewDraft.ts`
  baseline draft와 field shape
- `business/canonicalReviewValidation.ts`
  invalid submit 규칙과 first-invalid-field 결정
- `business/canonicalReviewResult.ts`
  risk score와 recommended route 계산
- `business/canonicalReviewStateMachine.ts`
  `idle/editing/invalid/submitting/success/error` 전이
- `handlers/canonicalReviewHandlerSupport.ts`
  activity presentation, flush, focus helper
- `handlers/createCanonicalReviewDraftHandlers.ts`
  success 이후 draft 변경 시 reopen 처리
- `handlers/createCanonicalReviewSubmissionHandlers.ts`
  submit/reset orchestration + qa-sdk logging
- `hooks/getCanonicalReviewData.ts`
  activity/debug/result panel용 파생값
- `views/CanonicalReviewView.ts`
  DOM 렌더링과 event binding
