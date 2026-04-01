---
def:
  id: pf-split
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

# PipeFlow: split — 데이터 분할

## 목적 ^purpose

하나의 데이터를 여러 항목으로 분할. 카테고리: 데이터변환.

## 정의 방식

필드: splitBy(필수), itemFlow(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

분할된 각 항목에 itemFlow 적용

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(itemFlow)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
