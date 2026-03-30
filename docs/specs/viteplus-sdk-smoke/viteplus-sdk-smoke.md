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
