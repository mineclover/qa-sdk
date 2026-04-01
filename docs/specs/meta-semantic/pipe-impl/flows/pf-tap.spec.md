---
def:
  id: pf-tap
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

# PipeFlow: tap — 관측

## 목적 ^purpose

흐름에 영향 없이 관측. 카테고리: 관측.

## 정의 방식

필드: observe(필수), step(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

observe 실행 + step 결과가 observe 유무와 무관

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
