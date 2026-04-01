---
def:
  id: pf-await
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

# PipeFlow: await — 조건 대기 후 실행

## 목적 ^purpose

조건 충족까지 대기 후 then 실행. 카테고리: 동시성.

## 정의 방식

필드: condition(필수), then(필수), timeout

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

조건 충족 시 then + 타임아웃 시 동작 확인

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(then)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
