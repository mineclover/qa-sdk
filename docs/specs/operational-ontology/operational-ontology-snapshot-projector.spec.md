---
def:
  id: operational-ontology-snapshot-projector
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: operational-ontology-runtime-interface
      type: refines
    - target: operational-ontology-observation-topology
      type: depends_on
    - target: operational-ontology-event-projector
      type: depends_on
    - target: operational-ontology-pipe-projector
      type: depends_on
    - target: operational-ontology-path-projector
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/snapshot-projector.ts
  - packages/operational-ontology/src/projectors-snapshot.ts
---

# Operational Ontology Snapshot Projector — 종합 관측 스냅샷 합성 표면

## 목적 ^purpose

event, pipe, lineage, path projector 결과를 하나의 runtime snapshot으로 합성하는 공개 표면을 고정한다. 목표는 corridor, junction, checkpoint, traversal을 같은 topology contract 아래에서 읽게 만드는 것이다.

## 구성 ^overview

snapshot projector는 아래를 담당한다.

- graph / record / schema / lineage / path observation 결과를 결합
- route decision에 `junctionId`, `corridorId`, `traversalKey`를 보강
- checkpoint lattice에 route decision checkpoint를 추가
- observation topology template를 기준으로 snapshot 전체를 검증

공개 진입점은 좁은 subpath로는 `operational-ontology/projectors/snapshot`를 사용한다.

## 정의 ^defines

### 입력

- `OperationalOntologyProjectionInput`
- optional `OperationalOntologyRuntimePorts`

### 출력

- `OperationalOntologySnapshot`
  - `corridors`
  - `controlFlows`
  - `checkpoints`
  - `checkpointLattices`
  - `junctions`
  - `routeDecisions`
  - `traversals`
  - `transmissions`
  - `lineageLinks`
  - `topologyValidation`

### 경계

- snapshot projector는 새로운 raw observation을 수집하지 않는다.
- 개별 projector의 내부 규칙을 대체하지 않고, 결과를 topology 아래에서 정렬한다.
- aggregate import인 `operational-ontology/projectors`는 convenience layer이고, 실제 책임은 각 projector subpath와 snapshot projector에 분산된다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-snapshot.test.ts`
