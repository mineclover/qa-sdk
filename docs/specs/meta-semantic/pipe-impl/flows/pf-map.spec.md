---
def:
  id: pf-map
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

# PipeFlow: map — 컬렉션 각 항목 처리

## 목적 ^purpose

collection 각 항목에 itemFlow 적용. 카테고리: 배치.

## 정의 방식

필드: itemFlow(필수), collection(필수), concurrency

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

각 항목에 흐름 적용 + concurrency 준수

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(itemFlow)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
