---
def:
  id: pf-fallback
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

# PipeFlow: fallback — 실패 시 대안

## 목적 ^purpose

try 실패 시 catch 실행. 카테고리: 내결함.

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
