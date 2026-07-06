---
def:
  id: pipe-types
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: ms-concept-pipe
      type: implements
sources:
  - packages/core/src/types/pipe-spec.ts
  - packages/core/src/pipe/pipe-validate.ts
  - packages/core/src/pipe/pipe-validate.test.ts
  - packages/core/src/pipe/pipe-path.ts
  - packages/core/src/pipe/pipe-path.test.ts
  - packages/core/src/pipe/pipe-flow-utils.ts
  - packages/core/src/pipe/pipe-flow-utils.test.ts
---

# PipeFlow 타입 정의

## 목적 ^purpose

PipeFlow 30종 흐름 제어 타입, PipeSpec(단일 노드), PipeGraph(노드 연결),
ConnectionKind 8종, PipePort/PortRef, Constraint 타입을 정의한다.

## 관련 소스

- `packages/core/src/types/pipe-spec.ts` — 전체 타입 정의

## 구성 ^overview

PipeFlow 30종 (fold topology 14분류):
- atomic(1): step
- linear(1): sequence
- conditional(2): branch, optional
- concurrent(3): parallel, race, await
- resilient(3): retry, fallback, circuit-breaker
- iterative(2): loop, feedback
- transactional(3): compensate, finally, transition-scope
- signaling(1): emit
- temporal(3): timeout, throttle, debounce
- batch(4): map, reduce, buffer, filter
- transformation(2): split, enrich
- streaming(2): resequence, window
- stateful(2): dedup, correlation
- observational(1): tap

ConnectionKind 8종: next, conditional, event, error, compensate, fan-out, join, feedback

PipePort: typed input/output port (portId, direction, facetType)
PortRef: port-level 연결 참조 (pipeId + portId)

PipeConnection: N:M 지원 (from/to: string | string[] | PortRef | PortRef[]), facetType 옵션

## 검증

타입 체크: `pnpm --filter @qa-sdk/core build`
