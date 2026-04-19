---
def:
  id: pf-compensate
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

# PipeFlow: compensate — 후속 실패 시 롤백

## 목적 ^purpose

forward 성공 후 후속 실패 시 보상. 카테고리: 트랜잭션.

## fold topology

분류: **transactional**.
`forward`와 `compensate`를 짝으로 접어 단일 트랜잭션 경계처럼 다룬다. 보상 경로는 내부에 숨기고 외부에는 본체 계약 하나만 노출한다.

## 정의 방식

필드: forward(필수), compensate(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

forward 후 후속 실패 → compensate 실행 확인

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(forward) + countPaths(compensate)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeCompensate`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer |
| concerns | — |
