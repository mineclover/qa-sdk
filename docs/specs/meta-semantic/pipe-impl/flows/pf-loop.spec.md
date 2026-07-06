---
def:
  id: pf-loop
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
  sources:
    - packages/core/src/types/pipe-spec.ts
    - packages/core/src/pipe/pipe-path.ts
    - packages/core/src/pipe/pipe-path.test.ts
    - packages/core/src/pipe/pipe-validate.ts
    - packages/core/src/pipe/pipe-validate.test.ts
    - packages/core/src/pipe/pipe-simulate.ts
    - packages/core/src/pipe/pipe-simulate.test.ts
    - packages/core/src/pipe/pipe-runtime.ts
    - packages/core/src/pipe/pipe-runtime.test.ts
    - packages/core/src/pipe/pipe-analyze.ts

---

# PipeFlow: loop — 조건까지 반복

## 목적 ^purpose

종료 조건이 만족될 때까지 같은 본체 흐름을 반복 실행하는 loop PipeFlow를 정의한다.

## fold topology

분류: **iterative**.
`body` 결과를 다시 같은 흐름의 입력으로 되먹임해 `until`까지 반복한다. 반복 횟수보다 수렴 규칙이 중요하므로 back-edge 중심의 iterative fold다.

## 정의 방식

필드: body(필수), until(필수), maxIterations(권장)

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

종료 조건 도달 + maxIterations 초과 정상 중단

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(body)

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeLoop`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | — |
