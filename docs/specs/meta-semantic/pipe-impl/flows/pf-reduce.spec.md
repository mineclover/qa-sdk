---
def:
  id: pf-reduce
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# PipeFlow: reduce — 결과 집계

## 목적 ^purpose

여러 항목을 하나로 누적. 카테고리: 배치.

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
