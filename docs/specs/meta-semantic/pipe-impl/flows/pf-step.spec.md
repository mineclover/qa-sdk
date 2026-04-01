---
def:
  id: pf-step
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

# PipeFlow: step — 개별 패싯 실행

## 목적 ^purpose

패싯 하나를 실행하는 최소 단위. 카테고리: 기본.

## 정의 방식

필드: facet(필수), eventKey, constraints, timeout, dataContract

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

단위 테스트로 입출력 확인. dataContract 있으면 스키마 호환 검증

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: 1

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
