---
def:
  id: pf-resequence
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

# PipeFlow: resequence — 순서 복원

## 목적 ^purpose

무순서 입력을 재정렬. 카테고리: 스트리밍.

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
