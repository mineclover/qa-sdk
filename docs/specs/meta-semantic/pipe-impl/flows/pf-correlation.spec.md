---
def:
  id: pf-correlation
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  type: knowledge
  knowledge_kind: concept
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

# PipeFlow: correlation — 요청/응답 매칭

## 목적 ^purpose

request + response를 key로 매칭. 카테고리: 상태.

## fold topology

분류: **stateful**.
`requestEvent`와 `responseEvent`를 상태 저장소에서 매칭해 하나의 continuation으로 접는다. 즉시 출력보다 매칭 상태가 방출 시점을 결정하는 stateful fold다.

## 정의 방식

필드: requestEvent(필수), responseEvent(필수), correlationKey(필수), onMatch(필수), timeout, onTimeout

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

매칭 성공→onMatch + 타임아웃→onTimeout

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(onMatch) + onTimeout

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeCorrelation`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | async-coupling |
