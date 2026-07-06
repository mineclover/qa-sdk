---
def:
  id: pf-retry
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

# PipeFlow: retry — 실패 시 재시도

## 목적 ^purpose

실패한 단계를 backoff 정책으로 다시 시도해 복원력을 높이는 retry PipeFlow를 정의한다.

## fold topology

분류: **resilient**.
같은 `step`을 동일 계약 아래 여러 번 재진입시키고 성공/한계 도달 결과만 외부에 노출한다. 실패를 흡수해 한 인터페이스에 접는 복원력 topology다.

## 정의 방식

필드: step(필수), maxAttempts(필수, >0), backoff

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

failureResolver=false로 재시도 동작 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeRetry`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | resilience |
