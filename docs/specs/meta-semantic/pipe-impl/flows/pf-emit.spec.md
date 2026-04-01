---
def:
  id: pf-emit
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

# PipeFlow: emit — 비동기 이벤트 발행

## 목적 ^purpose

결과 안 기다리고 이벤트 발행. 카테고리: 비동기.

## 정의 방식

필드: eventKey(필수), payload

> 타입: `core/src/types/pipe-spec.ts` 참조

## 검증 방식

producedEvents에 포함 확인

## 패싯/파이프 구분

패싯 데코레이터

## 경로 계산

`countPipePaths`: 1

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts`
