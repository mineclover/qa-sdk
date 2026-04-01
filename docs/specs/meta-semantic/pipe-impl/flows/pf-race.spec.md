---
def:
  id: pf-race
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

# PipeFlow: race — 동시 실행 먼저 완료

## 목적 ^purpose

steps 동시 시작, 먼저 완료된 것만. 카테고리: 동시성.

## 정의 방식

필드: steps(필수, 2+)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

raceResolver로 각 승자별 시뮬

## 패싯/파이프 구분

파이프 구조 (2+ 필수)

## 경로 계산

`countPipePaths`: Σ steps

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
