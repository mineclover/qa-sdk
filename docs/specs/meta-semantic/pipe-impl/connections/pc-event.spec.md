---
def:
  id: pc-event
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: pipe-connection-catalog
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# ConnectionKind: event — 이벤트 체인

## 목적 ^purpose

from.produces → to.trigger.eventKey 매칭.

## 정의 방식

필드: from(필수), to(필수)

> 타입: `core/src/types/pipe-spec.ts` `PipeConnection` 참조

## 검증 방식

이벤트 생산→트리거 확인

## 경로 계산

`countGraphPaths`: 곱

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts` `countGraphPaths()`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts` `validatePipeGraph()`
