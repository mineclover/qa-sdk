---
def:
  id: pf-throttle
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: traces_to
    - target: pipe-types
      type: traces_to
---

# PipeFlow: throttle — 빈도 제한

## 목적 ^purpose

interval 동안 rate 초과 시 제한. 카테고리: 안정화.

## fold topology

분류: **temporal**.
입력을 시간 구간으로 접어 허용된 빈도만 통과시킨다. 같은 호출 인터페이스를 유지하되 방출 시점과 통과 여부를 시간 규칙이 결정한다.

## 정의 방식

필드: step(필수), rate(필수), interval(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

rate 초과 시 지연/거부 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeThrottle`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | — |
