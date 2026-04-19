---
def:
  id: pf-feedback
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  type: knowledge
  knowledge_kind: concept
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

# PipeFlow: feedback — 폐루프 제어

## 목적 ^purpose

body 출력을 feedbackEvent로 재주입. 카테고리: 제어.

## fold topology

분류: **iterative**.
`body`의 결과를 `feedbackEvent`로 다시 주입해 수렴할 때까지 폐루프를 만든다. 외부에서는 한 번의 실행처럼 보이지만 내부에는 back-edge가 있는 iterative fold다.

## 정의 방식

필드: body(필수), feedbackEvent(필수), until(필수), maxIterations(권장)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

수렴 도달 + maxIterations 초과 정상 중단

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

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeFeedback`
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
