---
def:
  id: viteplus-sdk-smoke-system
  level: module
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [entry-point, frontend, testing, observability]
  links:
    - target: viteplus-canonical-review-implementation
      type: contains
    - target: viteplus-canonical-review-validation
      type: contains
    - target: viteplus-incident-escalation-implementation
      type: contains
    - target: viteplus-incident-escalation-validation
      type: contains
    - target: viteplus-playbook-template-implementation
      type: contains
    - target: viteplus-playbook-template-flow
      type: contains
    - target: viteplus-playbook-boundary-relation
      type: contains
    - target: viteplus-playbook-provider-stack
      type: contains
    - target: viteplus-playbook-app-state
      type: contains
    - target: viteplus-playbook-interaction
      type: contains
    - target: platform-sdk-user-scenarios
      type: depends_on
    - target: sdk-vite-onboarding-guide
      type: depends_on
    - target: sdk-usage-guide
      type: depends_on
---

# Vite+ Canonical Example

## 목적 ^purpose

`packages/viteplus-sdk-smoke`를 단순 import/build smoke를 넘어, qa-sdk logging과 implementation-convention 책임 분리를 함께 보여주는 canonical example 패키지로 고정한다.

## 방법 ^method

5개 boundary를 **contract descent 순서**로 중첩하고, 각 scope가 하위에 계약을 제공한다.

1. **qa-bridge**가 logging-session 계약을 제공하여 하위 전체가 logging 가능
2. **feature-context**가 state shape + persist 계약을 제공하여 handler/view가 공유 상태 접근 가능
3. **handlers/actions**가 submission-handlers 계약을 제공하여 view가 사용자 입력 처리 가능
4. **view**가 모든 상위 계약을 소비하여 DOM으로 표현

handlers 계층 내부에서만 PipeSpec transformer 패턴(소비→관리→생산)이 적용된다.
`validateScopeNesting()`으로 provider 순서의 계약 하향 정합성을 검증한다.

## 정의 ^defines

- **context-action 패턴** — scope nesting 기반 UI 아키텍처. contract descent의 런타임 구현체
- **playbook template** — 두 feature가 공유하는 runtime/store/dom/persist 유틸 세트

## 소비 ^consumes

- `@qa-sdk/sdk` — logging facade, NoopTransport
- `@qa-sdk/core` — validateScopeNesting, PipeSpec simulate (handlers 검증)
- `browser-monitor` — createQaMonitorAsync, emitWithCoords

## 위임 ^delegates

- **template-implementation** → 공통 runtime/store/dom helper 구현
- **template-flow** → 새 feature 확장 절차
- **provider-stack** → scope nesting 순서 규칙
- **boundary-relation** → boundary 단위/결합/조회 표준
- **app-state** → 공통 상태 모델
- **interaction** → UI 반응 규칙 5종
- **canonical-review-\*** → 첫 번째 feature (구현 + 검증)
- **incident-escalation-\*** → 두 번째 feature (구현 + 검증, 구조 대칭)

## 구성 ^overview

- `smoke.ts`와 `qa-bridge.ts`는 여전히 최소 소비처와 복사 가능한 브리지 템플릿 역할을 맡는다.
- `features/canonical-review/`는 Vite+ 안에서 `contexts/business/handlers/actions/hooks/views`를 어떻게 배치할지 보여주는 reference다.
- `features/incident-escalation/`는 같은 template로 두 번째 feature를 파생한 reference다.
- `viteplus-playbook-template-implementation`은 두 feature가 공유하는 runtime/view helper의 구현 문서다.
- `viteplus-playbook-template-flow`는 새 feature를 template 위에서 확장하는 절차 문서다.
- `viteplus-playbook-boundary-relation`은 컨텍스트 바운더리와 결합 표현 규칙을 설명한다.
- `viteplus-playbook-provider-stack`은 provider/composition 순서를 설명한다.
- `viteplus-playbook-app-state`는 공통 frontend state shape를 설명한다.
- `viteplus-playbook-interaction`은 invalid focus, reopen, reset 같은 UI 반응 규칙을 설명한다.
- `viteplus-canonical-review-implementation`은 구현 단위와 파일 책임을 고정한다.
- `viteplus-canonical-review-validation`은 invalid focus, success 전이, reopen, reset, build/test 명령을 검증 단위로 고정한다.
