---
def:
  id: pf-buffer
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

# PipeFlow: buffer — 배치 수집

## 목적 ^purpose

여러 입력을 개수 또는 시간 기준으로 모아 배치 단위로 처리하는 PipeFlow를 정의한다.

## fold topology

분류: **batch**.
여러 입력을 count/time 기준으로 모아 하나의 배치로 접은 뒤 `body`에 넘긴다. 요소 수는 N개지만 외부 계약은 배치 단위 한 번의 flush로 요약된다.

## 정의 방식

필드: body(필수), count 또는 duration

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

count/duration 충족 시 body 실행

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

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeBuffer`
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
