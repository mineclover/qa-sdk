---
def:
  id: pc-event
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
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

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `ConnectionKind` (`"event"`)
- 경로 계산: `packages/core/src/pipe-path.ts` — `countGraphPaths()` switch case
- 전파 규칙: `packages/core/src/pipe-interpret.ts` — `PIPE_PROPAGATION_RULES`
- 검증: `packages/core/src/pipe-validate.ts` — connection 검증
