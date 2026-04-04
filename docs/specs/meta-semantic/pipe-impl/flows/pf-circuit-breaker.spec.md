---
def:
  id: pf-circuit-breaker
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# PipeFlow: circuit-breaker — 장애 격리

## 목적 ^purpose

연속 실패를 감지해 차단·쿨다운·반개방 상태를 관리하는 장애 격리 PipeFlow를 정의한다.

## fold topology

분류: **resilient**.
`step` 실행 경로와 차단 상태(open/half-open/closed)를 같은 계약 아래 접어 실패 격리를 숨긴다. 외부에서는 단일 호출처럼 보이지만 내부에는 회복용 우회 판단이 있다.

## 정의 방식

필드: step(필수), failureThreshold(필수, >0), cooldown(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

연속 실패→개방→쿨다운→반개방→성공 시 폐쇄

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step) + 1

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeCircuitBreaker`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | resilience |
