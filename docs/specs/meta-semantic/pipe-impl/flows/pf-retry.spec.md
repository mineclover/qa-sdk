---
def:
  id: pf-retry
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

# PipeFlow: retry — 실패 시 재시도

## 목적 ^purpose

실패 시 backoff로 재시도. 카테고리: 내결함.

## 정의 방식

필드: step(필수), maxAttempts(필수, >0), backoff

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

failureResolver=false로 재시도 동작 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
