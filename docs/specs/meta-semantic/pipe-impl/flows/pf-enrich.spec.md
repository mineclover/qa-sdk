---
def:
  id: pf-enrich
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
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
