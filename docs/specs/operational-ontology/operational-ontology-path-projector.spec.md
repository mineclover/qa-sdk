---
def:
  id: operational-ontology-path-projector
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-runtime-interface
      type: refines
    - target: operational-ontology-junction
      type: depends_on
    - target: operational-ontology-traversal-coordinate
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/path-projector.ts
  - packages/operational-ontology/src/projectors-path.ts
---

# Operational Ontology Path Projector — PathObservation 투영 표면

## 목적 ^purpose

`PathObservation`과 `NonLinearPathObservation`을 traversal observation과 route decision으로 투영하는 공개 표면을 고정한다. 목표는 실제 실행 경로를 junction 판단과 traversal identity 관점으로 읽을 수 있게 만드는 것이다.

## 구성 ^overview

path projector는 아래를 담당한다.

- traversed edge를 `TraversalCoord`로 변환
- reached/unreachable goal을 `TraversalObservation`으로 정리
- non-linear branch point를 `RouteDecision`으로 materialize
- optional `JunctionTemplateRegistry`를 받아 route decision validation을 조절

공개 진입점은 좁은 subpath로는 `operational-ontology/projectors/path`를 사용한다.

## 정의 ^defines

### 입력

- `PathObservationProjectionInput`
  - `observation`
  - optional `JunctionTemplateRegistry`

### 출력

- `PathObservationProjectionResult`
  - `traversalObservations`
  - `branchDecisions`

### 경계

- path projector는 corridor를 직접 만들지 않는다.
- checkpoint lattice를 직접 만들지 않는다.
- `corridorId`, `junctionId`, `traversalKey`의 완전한 연결은 snapshot 단계에서 보강된다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-path.test.ts`
