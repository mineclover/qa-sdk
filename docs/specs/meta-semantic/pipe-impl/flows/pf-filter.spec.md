---
def:
  id: pf-filter
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

# PipeFlow: filter — 조건 통과만

## 목적 ^purpose

입력 집합 중 조건을 만족하는 항목만 남기고 나머지는 제거하는 filter PipeFlow를 정의한다.

## fold topology

분류: **batch**.
입력 집합을 조건 기준으로 접어 통과 항목만 남긴다. 요소별 판정은 내부에 숨기고 외부에는 축약된 batch 결과만 노출한다.

## 정의 방식

필드: condition(필수), step(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

filterResolver로 통과/소멸 양쪽 확인

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

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeFilter`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | data-filtering |
