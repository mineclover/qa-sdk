---
def:
  tier: component
  id: operational-ontology-observation-topology
  type: spec
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, observability]
  links:
    - target: operational-ontology-flow-corridor
      type: traces_to
    - target: operational-ontology-junction
      type: traces_to
    - target: operational-ontology-checkpoint
      type: traces_to
    - target: operational-ontology-runtime-interface
      type: traces_to
sources:
  - packages/operational-ontology/src/internal/topology-core.ts
  - packages/operational-ontology/src/topology.ts
---

# Operational Ontology Observation Topology — corridor/junction/checkpoint 상위 계약

## 목적 ^purpose

`operational-ontology`에서 corridor, junction, checkpoint를 각각 따로 검증하는 수준을 넘어, snapshot 전체가 어떤 배치를 가져야 하는지 상위 topology template로 정의한다. 목표는 “이 도로망에서 checkpoint와 갈림길이 어떤 식으로 함께 나타나야 하는가”를 하나의 계약으로 검증하는 것이다.

## 구성 ^overview

현재 topology template는 다음을 다룬다.

- `requireCorridorKinds`
- `requireJunctionTemplateKinds`
- `requireCheckpointTemplateKinds`
- `requireCheckpointLattices`
- `requireRouteDecisions`
- `requireTraversals`
- `minCorridors`
- `maxCorridors`
- `minCheckpointLatticeDepth`
- `requireRouteDecisionReferences`
- `requireCheckpointCorridorLink`

snapshot은 아래 메타데이터를 함께 가진다.

- `topologyTemplateKind`
- `topologyTemplateDescription`
- `topologyValidation`

## 정의 ^defines

### topology의 역할

topology는 아래 질문에 답한다.

- 이 snapshot에 어떤 corridor 종류가 반드시 있어야 하는가
- 어떤 junction family가 반드시 포함되어야 하는가
- 어떤 checkpoint template가 반드시 존재해야 하는가
- checkpoint lattice / route decision / traversal이 빠지면 invalid인가
- corridor가 너무 적거나 너무 많지는 않은가
- checkpoint lattice 깊이가 충분한가
- route decision이 junction/corridor/traversal을 제대로 참조하는가

### 왜 필요한가

corridor, junction, checkpoint를 각각 validation해도:

- corridor는 있는데 checkpoint가 전혀 없다
- route decision은 있는데 traversal이 없다
- checkpoint lattice는 있는데 junction family가 없다

같은 조합 불일치는 놓칠 수 있다.

topology template는 이런 조합 수준의 불일치를 잡는다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-snapshot.test.ts`
