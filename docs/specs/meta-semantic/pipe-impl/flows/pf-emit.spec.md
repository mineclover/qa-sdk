---
def:
  id: pf-emit
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

# PipeFlow: emit — 비동기 이벤트 발행

## 목적 ^purpose

결과 안 기다리고 이벤트 발행. 카테고리: 비동기.

## fold topology

분류: **signaling**.
실행의 핵심이 하위 패싯 합성이 아니라 `eventKey` 방출 그 자체다. 입력이 있으면 payload로 투영하고, 없더라도 독립 신호를 생성할 수 있는 topology다.

## 정의 방식

필드: eventKey(필수), payload

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

producedEvents에 포함 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: 1

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeEmit`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | producer |
| concerns | async-coupling |
