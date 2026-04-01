---
def:
  id: pf-buffer
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

# PipeFlow: buffer — 배치 수집

## 목적 ^purpose

N개 또는 T시간 모아서 처리. 카테고리: 배치.

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
