---
def:
  id: pf-window
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

# PipeFlow: window — 시간/개수 윈도우

## 목적 ^purpose

tumbling/sliding/session 구간화. 카테고리: 스트리밍.

## 정의 방식

필드: type(필수), size(필수), slide, gap, body(필수)

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

윈도우 경계에서 body 실행 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: countPaths(body)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
