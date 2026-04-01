---
def:
  id: pf-timeout
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

# PipeFlow: timeout — 흐름 시간 제한

## 목적 ^purpose

body에 시간 제한 래퍼. 카테고리: 시간.

## 정의 방식

필드: body(필수), duration(필수, >0), onTimeout

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

duration 이내 완료 + 초과 시 onTimeout

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(body) + onTimeout

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeTimeout`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case
