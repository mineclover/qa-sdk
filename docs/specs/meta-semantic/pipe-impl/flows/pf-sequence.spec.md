---
def:
  id: pf-sequence
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

# PipeFlow: sequence — 순차 실행

## 목적 ^purpose

여러 단계를 앞에서 뒤로 고정 순서대로 연결해 실행하는 sequence PipeFlow를 정의한다.

## fold topology

분류: **linear**.
`steps`를 앞에서 뒤로 직렬 연결해 하나의 ingress에서 하나의 egress로 접는다. 여러 하위 실행이 있어도 외부에는 순차 합성 결과만 보이는 linear topology다.

## 정의 방식

필드: steps(필수, 2+)

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

steps[i].produces ↔ steps[i+1].consumes 호환 검증

## 패싯/파이프 구분

파이프 구조 (2+ 필수)

## 경로 계산

`countPipePaths`: Π steps

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeSequence`
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
