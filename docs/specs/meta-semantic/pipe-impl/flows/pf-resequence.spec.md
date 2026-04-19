---
def:
  id: pf-resequence
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

# PipeFlow: resequence — 순서 복원

## 목적 ^purpose

무순서 스트림 입력을 기준 필드에 따라 다시 정렬해 순서를 복원하는 PipeFlow를 정의한다.

## fold topology

분류: **streaming**.
무순서 스트림을 버퍼링해 `orderBy` 기준으로 다시 정렬한 뒤 내보낸다. 순서 복원용 상태를 내부에 숨기고 동일한 stream contract를 유지하는 streaming fold다.

## 정의 방식

필드: orderBy(필수), windowSize(필수), step(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

정렬된 순서로 step 실행 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeResequence`
- 경로 계산: `packages/core/src/pipe-path.ts` — `countPipePaths()` switch case
- 검증: `packages/core/src/pipe-validate.ts` — `validateFlow()` switch case
- 시뮬레이션: `packages/core/src/pipe-simulate.ts` — `walkFlow()` switch case
- 런타임: `packages/core/src/pipe-runtime.ts` — `runFlow()` switch case
- 분석: `packages/core/src/pipe-analyze.ts` — `getChildFlows()` switch case


## 시각 표현

| 속성 | 값 |
|------|-----|
| role | consumer² |
| concerns | — |

> ² PipeSpec.produces 설정 시 transformer로 승격
