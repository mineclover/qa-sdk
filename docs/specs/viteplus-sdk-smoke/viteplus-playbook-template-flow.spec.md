---
def:
  tier: component
  id: viteplus-playbook-template-flow
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, migration, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-template-implementation
      type: depends_on
    - target: viteplus-playbook-boundary-relation
      type: depends_on
    - target: viteplus-playbook-provider-stack
      type: depends_on
    - target: sdk-vite-onboarding-guide
      type: depends_on
    - target: scope-classification-guide
      type: depends_on
    - target: definition-management
      type: depends_on
    - target: context-action-convention
      type: depends_on
sources:
  - packages/viteplus-sdk-smoke/src/features/canonical-review/CanonicalReviewExample.ts
  - packages/viteplus-sdk-smoke/src/features/incident-escalation/IncidentEscalationExample.ts
  - packages/viteplus-sdk-smoke/src/context-action-contract.ts
  - packages/viteplus-sdk-smoke/src/context-action-contract.test.ts
  - docs/specs/system/context-action-convention.rule.md
---

# Vite+ Playbook Template 확장 흐름

## 목적 ^purpose

공통 template 위에 새 Vite+ feature를 추가할 때 어떤 순서로 draft, validation, handlers, docs, tests를 복제하고 조정하는지 절차 흐름으로 고정한다.

## 정의 ^defines

- **template 확장 6단계 프로세스** — domain 정의 → context 연결 → view 작성 → handler logging 연결 → 테스트 추가 → 문서 등록

## 소비 ^consumes

- shared runtime/store/dom helper (`viteplus-playbook-template-implementation`)
- boundary 단위/결합 규칙 (`viteplus-playbook-boundary-relation`)
- provider composition order (`viteplus-playbook-provider-stack`)
- SDK 온보딩 가이드 (`sdk-vite-onboarding-guide`)
- scope 분류 기준 (`scope-classification-guide`)
- definition 관리 체계 (`definition-management`)
- context-action 문서화/검증 컨벤션 (`context-action-convention`)

## 구성 ^overview

- 새 feature는 먼저 domain draft와 validation을 정의한다.
- 그 다음 shared state/store/dom helper를 조합하는 context와 view를 만든다.
- handler에서 qa-sdk logging event/metric 이름을 domain에 맞게 바꾼다.
- 마지막으로 `feature/func_def` 구현 문서와 `feature/scenario` validation 문서를 추가한다.

## 프로세스 ^steps

1. domain 입력 필드와 validation rule을 정의한다.
2. `shared/runtime/playbookStateMachine.ts`와 `playbookStore.ts`를 context에 연결한다.
3. `shared/views/playbookDom.ts`를 사용해 view를 만든다.
4. submit/reset handler에서 domain별 logging key와 metric name을 연결한다.
5. state machine test, feature orchestration test, build/test 명령을 추가한다.
6. 구현 문서는 `feature/func_def`, 검증 문서는 `feature/scenario`로 등록하고, context-action 공통 규칙은 복제하지 않고 `context-action-convention`으로 링크한다.

## scope/aspect 배정 이유

- `scope: flow`
  이 문서는 템플릿 자체가 아니라 “새 feature를 템플릿에서 어떻게 파생시키는가”라는 순서를 다룬다.
- `aspect: process_flow`
  분기와 순서가 핵심이므로 기능 정의가 아니라 프로세스 흐름 문서로 분류한다.
