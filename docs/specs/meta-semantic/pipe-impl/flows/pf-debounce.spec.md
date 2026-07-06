---
def:
  id: pf-debounce
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

# PipeFlow: debounce — 반복 무시

## 목적 ^purpose

짧은 시간 안의 반복 입력을 접어 마지막 안정 입력만 실행하는 debounce PipeFlow를 정의한다.

## fold topology

분류: **temporal**.
연속 트리거를 시간축에서 접어 마지막 안정 입력만 `step`으로 전달한다. 입력 수보다 실행 횟수를 줄이는 시간 기반 합성 패턴이다.

## 정의 방식

필드: step(필수), wait(필수)

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

wait 경과 후 실행 + 추가 시 리셋

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeDebounce`
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
