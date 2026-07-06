---
def:
  id: pf-await
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

# PipeFlow: await — 조건 대기 후 실행

## 목적 ^purpose

조건 충족까지 대기 후 then 실행. 카테고리: 동시성.

## fold topology

분류: **concurrent**.
외부 조건 충족이라는 보조 신호와 `then` continuation을 한 인터페이스에서 합류시킨다. 선행 입력은 유지하되 완료 시점만 동기화하는 동시성 fold다.

## 정의 방식

필드: condition(필수), then(필수), timeout

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

조건 충족 시 then + 타임아웃 시 동작 확인

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(then)

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeAwait`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | latency |
