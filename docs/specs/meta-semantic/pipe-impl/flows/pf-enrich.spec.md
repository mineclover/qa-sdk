---
def:
  id: pf-enrich
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

# PipeFlow: enrich — 데이터 보강

## 목적 ^purpose

외부 소스에서 데이터 조회 후 병합. 카테고리: 데이터변환.

## fold topology

분류: **transformation**.
주 입력에 외부 `source`를 붙여 `mergeField` 기준으로 보강한 결과를 만든다. 원본 payload에 side input을 합성해 다른 형태의 출력으로 바꾸는 transformation fold다.

## 정의 방식

필드: source(필수), mergeField(필수), step(필수), timeout

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

외부 데이터 병합 + step 실행 확인

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(step)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `PipeEnrich`
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
