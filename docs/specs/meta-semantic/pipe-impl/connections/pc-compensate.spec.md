---
def:
  id: pc-compensate
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

# ConnectionKind: compensate — 보상 롤백

## 목적 ^purpose

후속 단계 실패 시 보상 경로가 선행 결과를 롤백하는 연결 semantics를 정의한다.

## 정의 방식

필드: from(필수), to(필수)

> 타입: `core/src/types/pipe-spec.ts` `PipeConnection` 참조

## 검증 방식

후속 실패 시 to(보상) 실행 + 상태 복원

## 경로 계산

`countGraphPaths`: 합

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts` `countGraphPaths()`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts` `validatePipeGraph()`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `ConnectionKind` (`"compensate"`)
- 경로 계산: `packages/core/src/pipe-path.ts` — `countGraphPaths()` switch case
- 전파 규칙: `packages/core/src/pipe-interpret.ts` — `PIPE_PROPAGATION_RULES`
- 검증: `packages/core/src/pipe-validate.ts` — connection 검증
