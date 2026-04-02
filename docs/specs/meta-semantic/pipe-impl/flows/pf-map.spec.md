---
def:
  id: pf-map
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

# PipeFlow: map — 컬렉션 각 항목 처리

## 목적 ^purpose

collection 각 항목에 itemFlow 적용. 카테고리: 배치.

## fold topology

분류: **batch**.
컬렉션 하나를 여러 item 단위 실행으로 펼쳤다가 다시 결과 집합으로 접는다. 내부 fan-out은 N개지만 외부 인터페이스는 collection ingress/egress 한 쌍으로 유지된다.

## 정의 방식

필드: itemFlow(필수), collection(필수), concurrency

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

각 항목에 흐름 적용 + concurrency 준수

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(itemFlow)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeMap`
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
