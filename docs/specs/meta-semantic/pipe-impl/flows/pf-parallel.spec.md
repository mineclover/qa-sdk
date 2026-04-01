---
def:
  id: pf-parallel
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# PipeFlow: parallel — 동시 실행 전부 대기

## 목적 ^purpose

steps 전부 동시 시작, 전부 완료 대기. 카테고리: 동시성.

## 정의 방식

필드: steps(필수, 2+)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

모든 step 결과 수집 확인

## 패싯/파이프 구분

파이프 구조 (2+ 필수)

## 경로 계산

`countPipePaths`: Π steps

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeParallel`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case
