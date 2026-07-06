---
def:
  id: pf-emit
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

# PipeFlow: emit — 비동기 이벤트 발행

## 목적 ^purpose

현재 흐름의 완료를 기다리지 않고 독립적인 비동기 이벤트를 방출하는 PipeFlow를 정의한다.

## fold topology

분류: **signaling**.
실행의 핵심이 하위 패싯 합성이 아니라 `eventKey` 방출 그 자체다. 입력이 있으면 payload로 투영하고, 없더라도 독립 신호를 생성할 수 있는 topology다.

## 정의 방식

필드: eventKey(필수), payload

> 타입: `packages/core/src/types/pipe-spec.ts` 참조

## 검증 방식

producedEvents에 포함 확인

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

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeEmit`
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | producer |
| concerns | async-coupling |
