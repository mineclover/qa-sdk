---
def:
  id: viteplus-sdk-smoke-system
  tier: system
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
    - target: viteplus-playbook-boundary-coupling
      type: contains
    - target: viteplus-playbook-provider-stack
      type: contains
    - target: viteplus-playbook-app-state
      type: contains
    - target: viteplus-playbook-state-transition
      type: contains
    - target: viteplus-playbook-interaction
      type: contains
    - target: viteplus-playbook-user-scenarios
      type: contains
    - target: scope-nesting-system
      type: depends_on
    - target: platform-sdk-user-scenarios
      type: contains
    - target: sdk-vite-onboarding-guide
      type: contains
    - target: sdk-usage-guide
      type: contains
    - target: viteplus-sdk-smoke-marker-review
      type: traces_to
---

# Vite+ Canonical Example

## 목적 ^purpose

`packages/viteplus-sdk-smoke`를 단순 import/build smoke를 넘어, qa-sdk logging과 implementation-convention 책임 분리를 함께 보여주는 canonical example 패키지로 고정한다.

## 방법 ^method

5개 boundary를 **contract descent 순서**로 중첩하고, 각 scope가 하위에 계약을 제공한다. scope-nesting 인프라(`scope-nesting-system`)를 소비하여 구조+마운트+전이+경로를 검증한다.

1. **qa-bridge**가 logging-session 계약을 제공하여 하위 전체가 logging 가능
2. **feature-context**가 state shape + persist 계약을 제공하여 handler/view가 공유 상태 접근 가능
3. **handlers/actions**가 submission-handlers 계약을 제공하여 view가 사용자 입력 처리 가능
4. **view**가 모든 상위 계약을 소비하여 DOM으로 표현

handlers 계층 내부에서만 PipeSpec transformer 패턴(소비→관리→생산)이 적용된다.

## 정의 ^defines

- **context-action 패턴** — scope nesting 기반 UI 아키텍처. contract descent의 런타임 구현체
- **playbook template** — 두 feature가 공유하는 runtime/store/dom/persist 유틸 세트

## 소비 ^consumes

- `@qa-sdk/sdk` — logging facade, NoopTransport
- `@qa-sdk/core` — scope-nesting-system 전체 (validateScopeNesting, validateMountFlow, validateContractTiming, simulate)
- `browser-monitor` — createQaMonitorAsync, emitWithCoords

## 위임 ^delegates

### 구조 정의
- **boundary-relation** → boundary 단위 5종, scope 역할
- **provider-stack** → scope nesting 순서 규칙
- **app-state** → state shape 8슬롯
- **interaction** → UI 반응 규칙 5종

### 규칙/제약
- **boundary-coupling** → 결합 표현 4종 + 조회 표준
- **state-transition** → 전이 6종 + 불변량

### 구현
- **template-implementation** → 공통 runtime/store/dom helper
- **template-flow** → 새 feature 확장 6단계 프로세스

### feature (구현 + 검증)
- **canonical-review-\*** → 첫 번째 feature (대칭 기준)
- **incident-escalation-\*** → 두 번째 feature (대칭 검증)

### 유저 시나리오
- **user-scenarios** → 6종 사용자 시나리오

## 구성 ^overview

13개 하위 문서 + scope-nesting-system 의존.

### 정의 패싯 (4)

| 문서 | 정의하는 것 |
|------|-----------|
| `boundary-relation` | boundary 단위 5종, boundary = scope |
| `provider-stack` | scope nesting 순서 규칙, contract descent 구현 |
| `app-state` | playbook state shape 8개 슬롯 |
| `interaction` | UI 반응 규칙 5종 |

### 관리 패싯 (2)

| 문서 | 관리하는 것 |
|------|-----------|
| `boundary-coupling` | 결합 표현 4종 + overview 표준 + 조회 3단계 |
| `state-transition` | status 전이 6종 + 불변량 3종 |

### 생산 패싯 (3)

| 문서 | 생산하는 것 |
|------|-----------|
| `template-implementation` | 공통 runtime/store/dom/persist helper 5개 |
| `canonical-review-implementation` | 첫 번째 feature 구현 단위 |
| `incident-escalation-implementation` | 두 번째 feature 구현 단위 (대칭) |

### 프로세스 (1)

| 문서 | 절차 |
|------|------|
| `template-flow` | 새 feature 확장 6단계 프로세스 |

### 검증 패싯 (2)

| 문서 | 검증하는 것 |
|------|-----------|
| `canonical-review-validation` | 상태 전이 + handler orchestration + 변형 2종 |
| `incident-escalation-validation` | 동일 구조 (대칭) + severity 변형 2종 |

### 유저 시나리오 (1)

| 문서 | 시나리오 |
|------|---------|
| `user-scenarios` | 새 feature 추가, 순서 변경 검증, 경량 모드, mock override, 타이밍 검출, gap 검출 |

### 인프라 의존 (scope-nesting-system)

scope-nesting 검증 프레임워크는 `scope-nesting-system` module에서 독립 관리.
`@qa-sdk/core`에 구현, viteplus-sdk-smoke은 canonical 소비처.
