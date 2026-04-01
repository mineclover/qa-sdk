---
def:
  id: pf-finally
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

# PipeFlow: finally — 항상 실행

## 목적 ^purpose

body 성공/실패 무관 cleanup 실행. 카테고리: 정리.

## 정의 방식

필드: body(필수), cleanup(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

body 성공/실패 모두 cleanup 실행 확인

## 패싯/파이프 구분

파이프 구조 (2 필수)

## 경로 계산

`countPipePaths`: countPaths(body)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
