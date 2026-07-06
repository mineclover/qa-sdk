---
def:
  id: pf-dedup
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

# PipeFlow: dedup — 중복 제거

## 목적 ^purpose

중복 key를 기억해 이미 본 입력을 소거하고 신규 입력만 통과시키는 dedup PipeFlow를 정의한다.

## fold topology

분류: **stateful**.
현재 입력과 과거에 본 key 상태를 함께 접어 중복이면 소거하고 신규면 통과시킨다. 출력 여부가 숨은 상태에 의해 결정되므로 stateful topology다.

## 정의 방식

필드: keyField(필수), ttl, step(필수)

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

중복 소멸 + ttl 경과 후 재통과

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step) + 1

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeDedup`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | data-filtering |
