---
def:
  id: pf-compensate
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

# PipeFlow: compensate — 후속 실패 시 롤백

## 목적 ^purpose

forward 성공 후 후속 실패 시 보상. 카테고리: 트랜잭션.

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
