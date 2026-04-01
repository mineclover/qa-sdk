---
def:
  id: pf-throttle
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

# PipeFlow: throttle — 빈도 제한

## 목적 ^purpose

interval 동안 rate 초과 시 제한. 카테고리: 안정화.

## 정의 방식

필드: step(필수), rate(필수), interval(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

rate 초과 시 지연/거부 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
