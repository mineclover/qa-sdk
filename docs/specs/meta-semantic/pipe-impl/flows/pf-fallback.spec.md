---
def:
  id: pf-fallback
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

# PipeFlow: fallback — 실패 시 대안

## 목적 ^purpose

기본 경로가 실패했을 때 대체 경로가 같은 계약을 이어받는 fallback PipeFlow를 정의한다.

## fold topology

분류: **resilient**.
`try`와 `catch` 두 실행면을 하나의 파이프 계약으로 접는다. 기본 경로가 실패하면 대체 경로가 같은 ingress/egress를 이어받는 복원력 패턴이다.

## 정의 방식

필드: try(필수), catch(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

failureResolver true→try, false→catch

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(try) + countPaths(catch)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeFallback`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | resilience |
