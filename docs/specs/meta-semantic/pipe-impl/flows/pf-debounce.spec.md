---
def:
  id: pf-debounce
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

# PipeFlow: debounce — 반복 무시

## 목적 ^purpose

wait 동안 추가 없으면 실행. 카테고리: 안정화.

## 정의 방식

필드: step(필수), wait(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

wait 경과 후 실행 + 추가 시 리셋

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
