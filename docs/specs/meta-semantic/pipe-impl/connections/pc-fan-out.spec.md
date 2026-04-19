---
def:
  id: pc-fan-out
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

# ConnectionKind: fan-out — 1:N 동시 시작

## 목적 ^purpose

하나의 완료 이벤트가 여러 후속 단계를 동시에 시작시키는 fan-out 연결 semantics를 정의한다.

## 정의 방식

필드: from(필수), to(필수, 2+)

> 타입: `core/src/types/pipe-spec.ts` `PipeConnection` 참조

## 검증 방식

to[] 전부 실행 확인

## 경로 계산

`countGraphPaths`: 곱

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts` `countGraphPaths()`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts` `validatePipeGraph()`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `ConnectionKind` (`"fan-out"`)
- 경로 계산: `packages/core/src/pipe-path.ts` — `countGraphPaths()` switch case
- 전파 규칙: `packages/core/src/pipe-interpret.ts` — `PIPE_PROPAGATION_RULES`
- 검증: `packages/core/src/pipe-validate.ts` — connection 검증
