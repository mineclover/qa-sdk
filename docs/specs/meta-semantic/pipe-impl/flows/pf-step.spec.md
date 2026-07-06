---
def:
  id: pf-step
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: traces_to
    - target: pipe-types
      type: traces_to
sources:
  - packages/core/src/types/pipe-spec.ts
  - packages/core/src/pipe/pipe-path.ts
  - packages/core/src/pipe/pipe-path.test.ts
  - packages/core/src/pipe/pipe-validate.ts
  - packages/core/src/pipe/pipe-validate.test.ts
  - packages/core/src/pipe/pipe-simulate.ts
  - packages/core/src/pipe/pipe-simulate.test.ts
  - packages/core/src/pipe/pipe-runtime.ts
  - packages/core/src/pipe/pipe-runtime.test.ts
  - packages/core/src/pipe/pipe-analyze.ts
---

# PipeFlow: step — 개별 패싯 실행

## 목적 ^purpose

하나의 패싯 실행을 독립 계약으로 노출하는 최소 단위 PipeFlow를 정의한다.

## fold topology

분류: **atomic**.
하위 분기나 보조 경로 없이 `facet` 하나를 그대로 실행 인터페이스로 노출한다. 입력 한 번이 곧 실행 한 번으로 대응하는 최소 합성 패턴이다.

## 정의 방식

필드: facet(필수), eventKey, constraints, timeout, dataContract

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

단위 테스트로 입출력 확인. dataContract 있으면 스키마 호환 검증

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: 1

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeStep`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | — ¹ |

> ¹ timeout 필드 있으면 latency 추가; dataContract.accesses write/readwrite 있으면 data-mutation 추가
