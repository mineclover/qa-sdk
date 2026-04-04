---
def:
  id: pf-tap
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

# PipeFlow: tap — 관측

## 목적 ^purpose

주 경로의 결과를 바꾸지 않고 옆에서 관측만 수행하는 tap PipeFlow를 정의한다.

## fold topology

분류: **observational**.
`step`의 주 경로를 유지한 채 `observe`를 옆으로 덧붙이는 sidecar 합성이다. 관측 branch는 결과를 바꾸지 않으므로 observational topology로 분류한다.

## 정의 방식

필드: observe(필수), step(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

observe 실행 + step 결과가 observe 유무와 무관

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeTap`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | observer |
| concerns | observability |
