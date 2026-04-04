---
def:
  id: scope-nesting-system
  level: module
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [structural, testing]
  links:
    - target: scope-nesting-guide
      type: contains
    - target: scope-nesting-validation-rules
      type: contains
    - target: scope-nesting-procedure
      type: contains
    - target: scope-nesting-provider-patterns
      type: contains
    - target: scope-nesting-mount-flow
      type: contains
    - target: scope-nesting-contract-timing
      type: contains
    - target: scope-nesting-simulation-layers
      type: contains
    - target: scope-nesting-visualization
      type: contains
    - target: scope-nesting-procedure-test
      type: contains
    - target: scope-nesting-contract-timing-test
      type: contains
    - target: scope-nesting-simulation-layers-test
      type: contains
    - target: ms-concept-contract-descent
      type: implements
    - target: ms-concept-boundary
      type: implements
---

# Scope Nesting System

## 목적 ^purpose

contract descent 기반 스코프 중첩 검증 프레임워크. scope가 계약을 소유하고, nesting 순서가 계약 하향 경로를 형성하며, pipe 실행과 교차 검증한다. `@qa-sdk/core`에 구현.

## 방법 ^method

**scope-nesting-guide**가 contract descent 검증의 핵심 API(validateScopeNesting, checkSwapSafety, resolveContracts)를 정의하고,
**provider-patterns**가 override, optional, resolution, lifecycle 4패턴을 확장하고,
**mount-flow**가 scope↔pipe 브릿지(validateMountFlow)로 마운트 시점 계약 가용성을 검증하고,
**contract-timing**이 readyAfter/delegatesTo로 시뮬 결과와 교차하여 시점 정합성을 분석하고,
**simulation-layers**가 L0→L1→L1.5→L2→L3 5계층 모델로 전체를 조합한다.

## 정의 ^defines

- **ScopeContract** — scope가 소유하는 계약 (provides/consumes)
- **ScopeNesting** — scope 중첩 순서
- **SimulationGuards** — L0 운영 상태 guard (fail-open)
- **MountFlowBinding** — scope↔pipe 매핑
- **ContractRef.readyAfter** — 비동기 초기화 시점
- **DelegationRef** — 역방향 위임 선언

## 소비 ^consumes

- contract descent 원칙 (`ms-concept-contract-descent`)
- boundary 개념 (`ms-concept-boundary`)
- PipeSpec simulate (`pipe-simulate`)

## 위임 ^delegates

- **scope-nesting-guide** → 핵심 API 사용법
- **validation-rules** → 검증 규칙 8종 + L0 guard 정책
- **procedure** → scope 추가/변경/제거 절차
- **provider-patterns** → override, optional, resolution, lifecycle 4패턴 (각각 leaf)
- **mount-flow** → scope↔pipe 브릿지 (L1.5)
- **contract-timing** → readyAfter + delegation gap 시점 분석
- **simulation-layers** → 5계층 모델 정의

## 구성 ^overview

| 구현 파일 | 테스트 |
|----------|--------|
| `core/src/scope-nesting.ts` | 32건 |
| `core/src/scope-nesting-mount.ts` | 9건 |
| `core/src/scope-nesting-timing.ts` | 6건 |
| `core/src/scope-nesting-state.ts` | 21건 |
| `core/src/scope-nesting-simulate.test.ts` | 17건 |
| **합계** | **85건** |
