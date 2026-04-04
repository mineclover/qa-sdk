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
    - target: viteplus-playbook-scope-nesting
      type: contains
    - target: viteplus-playbook-app-state
      type: contains
    - target: viteplus-playbook-state-transition
      type: contains
    - target: viteplus-playbook-boundary-coupling
      type: contains
    - target: viteplus-playbook-interaction
      type: contains
    - target: viteplus-playbook-simulation-layers
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
- **scope-nesting** → contract descent 검증 가이드
- **boundary-relation** → boundary 단위 정의
- **boundary-coupling** → 결합 규칙 + 조회 표준
- **app-state** → state shape 정의
- **state-transition** → 전이 규칙
- **interaction** → UI 반응 규칙 5종
- **canonical-review-\*** → 첫 번째 feature (구현 + 검증)
- **incident-escalation-\*** → 두 번째 feature (구현 + 검증, 구조 대칭)

## 구성 ^overview

12개 하위 문서를 패싯 기준으로 분류한다.

### 정의 패싯 — 구조와 규칙

| 문서 | 정의하는 것 |
|------|-----------|
| `boundary-relation` | boundary 단위 5종, boundary = scope |
| `provider-stack` | scope nesting 순서 규칙, contract descent 구현 |
| `app-state` | playbook state shape 8개 슬롯 |
| `interaction` | UI 반응 규칙 5종 (focus, feedback, reopen, reset, debug) |

### 관리 패싯 — 규칙과 제약

| 문서 | 관리하는 것 |
|------|-----------|
| `scope-nesting` | contract descent 검증 가이드 + 계약 선언 + 검증 방법 |
| `boundary-coupling` | 결합 표현 4종 + overview 표준 + 조회 3단계 |
| `state-transition` | status 전이 6종 + 불변량 |

### 생산 패싯 — 구현

| 문서 | 생산하는 것 |
|------|-----------|
| `template-implementation` | 공통 runtime/store/dom/persist helper 5개 |
| `canonical-review-implementation` | 첫 번째 feature 구현 단위 |
| `incident-escalation-implementation` | 두 번째 feature 구현 단위 (대칭) |

### 프로세스 — 절차

| 문서 | 절차 |
|------|------|
| `template-flow` | 새 feature 확장 6단계 프로세스 |

### 검증 패싯 — 테스트 시나리오

| 문서 | 검증하는 것 |
|------|-----------|
| `canonical-review-validation` | 상태 전이 + handler orchestration + build/test |
| `incident-escalation-validation` | 동일 구조 (대칭) + severity 변형 |
| `simulation-layers` | 3계층 시뮬레이션 모델 (L1 구조 → L2 전이 → L3 경로) |
