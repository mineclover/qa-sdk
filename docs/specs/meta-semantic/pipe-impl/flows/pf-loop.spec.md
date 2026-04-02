---
def:
  id: pf-loop
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

# PipeFlow: loop — 조건까지 반복

## 목적 ^purpose

종료 조건 충족까지 body 반복. 카테고리: 반복.

## fold topology

분류: **iterative**.
`body` 결과를 다시 같은 흐름의 입력으로 되먹임해 `until`까지 반복한다. 반복 횟수보다 수렴 규칙이 중요하므로 back-edge 중심의 iterative fold다.

## 정의 방식

필드: body(필수), until(필수), maxIterations(권장)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

종료 조건 도달 + maxIterations 초과 정상 중단

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(body)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeLoop`
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
