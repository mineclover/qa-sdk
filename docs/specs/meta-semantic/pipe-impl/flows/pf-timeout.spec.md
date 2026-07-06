---
def:
  id: pf-timeout
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

# PipeFlow: timeout — 흐름 시간 제한

## 목적 ^purpose

본체 흐름에 시간 제한과 초과 처리 경로를 결합하는 timeout PipeFlow를 정의한다.

## fold topology

분류: **temporal**.
`body` 실행과 deadline을 함께 접어 시간 초과 여부를 topology 차원에서 결정한다. 완료 경로와 `onTimeout` 우회 경로가 모두 clock에 종속된다.

## 정의 방식

필드: body(필수), duration(필수, >0), onTimeout

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

duration 이내 완료 + 초과 시 onTimeout

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(body) + onTimeout

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeTimeout`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | latency |
