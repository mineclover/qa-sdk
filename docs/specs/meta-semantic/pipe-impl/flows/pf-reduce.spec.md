---
def:
  id: pf-reduce
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

# PipeFlow: reduce — 결과 집계

## 목적 ^purpose

여러 항목을 누적기 하나로 접어 최종 집계 결과를 만드는 reduce PipeFlow를 정의한다.

## fold topology

분류: **batch**.
여러 항목을 accumulator 하나로 점진적으로 접어 최종 결과 하나를 만든다. 요소별 intermediate state를 숨기고 집계 결과만 외부로 노출한다.

## 정의 방식

필드: step(필수), initial(필수), accumulator(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

누적 결과가 기대값과 일치

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

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeReduce`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer² |
| concerns | — |

> ² PipeSpec.produces 설정 시 transformer로 승격
