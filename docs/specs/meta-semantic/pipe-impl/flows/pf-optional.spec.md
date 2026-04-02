---
def:
  id: pf-optional
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

# PipeFlow: optional — 선택적 실행

## 목적 ^purpose

있어도 없어도 통과. 카테고리: 분기.

## fold topology

분류: **conditional**.
`step` 실행 경로와 bypass 경로를 함께 접는다. 실행해도 되고 건너뛰어도 되는 두 선택지를 하나의 조건형 topology로 제공한다.

## 정의 방식

필드: step(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

filterResolver true/false 양쪽 시나리오

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

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeOptional`
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
