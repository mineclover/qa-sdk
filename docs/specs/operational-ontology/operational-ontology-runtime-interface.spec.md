---
def:
  id: operational-ontology-runtime-interface
  type: knowledge
  knowledge_kind: concept
  tier: system
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-data-facets
      type: contains
    - target: operational-ontology-information-transmission
      type: contains
    - target: operational-ontology-lineage
      type: contains
    - target: operational-ontology-branch-handling
      type: contains
    - target: operational-ontology-control-flow
      type: contains
    - target: operational-ontology-simulation
      type: contains
    - target: operational-ontology-event-projector
      type: contains
    - target: operational-ontology-pipe-projector
      type: contains
    - target: operational-ontology-path-projector
      type: contains
    - target: operational-ontology-snapshot-projector
      type: contains
    - target: operational-ontology-system
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/runtime-core.ts
  - packages/operational-ontology/src/internal/projector-core.ts
  - packages/operational-ontology/src/internal/projector-types.ts
  - packages/operational-ontology/src/internal/projector-shared.ts
  - packages/operational-ontology/src/internal/projector-utils.ts
  - packages/operational-ontology/src/projectors.ts
  - packages/operational-ontology/src/runtime.ts
---

# Operational Ontology Runtime Interface — 현재 시스템에 붙기 위한 운영 포트

## 목적 ^purpose

`operational-ontology`를 현재 시스템 위에서 실제로 운용할 수 있도록, 현재 runtime 타입을 입력으로 받아 operational ontology 해석층으로 투영하는 인터페이스를 정의한다. 목표는 추상 개념을 유지하면서도 `EventRecord`, `PipeGraph`, `DataSchema/FieldLineage`, `PathObservation`과 직접 맞닿는 운영 포트를 고정하는 것이다.

## 구성 ^overview

현재 시스템과 맞닿는 핵심 입력은 네 종류다.

- **EventRecord**
  - `address_context`와 runtime event를 semantic transmission 관점으로 투영
- **PipeGraph**
  - 제어 흐름과 transmission skeleton으로 투영
- **DataSchema / FieldLineage**
  - 정보 facet 사이의 lineage로 투영
- **PathObservation / NonLinearPathObservation**
  - traversal observation과 branch decision으로 투영

이 네 입력을 각각 별도 projector port로 나누고, 최상위에서는 `OperationalOntologyRuntimePorts`로 묶는다. 이 문서는 projector family의 module 문서이고, 각 세부 projector surface는 하위 leaf 문서에서 따로 고정한다.

public package surface에서는 아래 좁은 subpath를 우선 사용한다.

- `operational-ontology/projectors/event`
- `operational-ontology/projectors/pipe`
- `operational-ontology/projectors/path`
- `operational-ontology/projectors/snapshot`

`operational-ontology/projectors`는 이들을 한 번에 묶어 가져오기 위한 aggregate convenience layer로 본다.

## 정의 ^defines

### runtime ports

초기 포트는 아래를 기준으로 둔다.

- `OperationalOntologyEventRecordProjector`
- `OperationalOntologyPipeGraphProjector`
- `OperationalOntologyLineageProjector`
- `OperationalOntologyPathObservationProjector`
- `OperationalOntologyRuntimePorts`
- `projectOperationalOntologySnapshot`

### 포트별 책임

1. **event projector**
   `EventRecord`와 `address_context`를 받아 관측된 node/edge/transmission으로 변환하고, synthetic observed data flow definition을 생성한다. payload가 object면 top-level field까지 contract/endpoint/link로 분해한다. baseline checkpoint는 최소한 `corridorId`를 가지며, checkpoint lattice를 함께 생성할 수 있다. 필요하면 checkpoint template registry를 받아 lattice materialization 방식을 바꿀 수 있다.
2. **pipe graph projector**
   `PipeGraph`를 받아 control flow graph, data flow definition, transmission skeleton, branch definition, lineage skeleton을 생성한다. 필요하면 `schemas`와 `lineages`를 함께 받아 one-shot 정렬 결과를 만든다. corridor template registry를 주입하면 materialized corridor metadata와 `templateValidation`도 달라질 수 있고, junction template registry를 주입하면 branch definition의 template metadata와 path shape validation도 달라질 수 있다.
3. **lineage projector**
   `DataSchema`와 `FieldLineage`를 받아 data lineage link를 생성한다. schema가 있으면 `columns[*].facetRole`을 읽어 source/target facet kind를 더 정밀하게 맞춘다.
4. **path observation projector**
   `PathObservation`을 받아 traversal observation과 branch decision을 생성한다. junction template registry를 주입하면 route decision metadata와 allowed mode/path count 검증도 달라질 수 있다.
5. **snapshot orchestrator**
   graph / record / schema / lineage / path observation 결과를 하나의 `corridors + checkpoints + junctions + traversals` snapshot으로 합성한다. 이때 `routeDecision`은 `junctionId`, `corridorId`, `traversalKey`를 통해 실제 corridor 위의 갈림길 판단으로 연결되고, checkpoint도 가능한 경우 같은 `junctionId`와 `traversalKey`를 공유한다. snapshot phase에서는 route decision checkpoint가 checkpoint lattice에 추가될 수 있고, template registry를 통해 그 relation을 조절할 수 있다. observation topology template registry를 주입하면 snapshot 전체의 배치 contract와 validation을 조절할 수 있다.

### 경계

이 문서는 projector 인터페이스만 정의한다.

- 실제 encode/decode 알고리즘은 아직 포함하지 않는다.
- 현재 단계에서는 current system types와 operational-ontology vocabulary를 연결하는 shape를 먼저 고정한다.
- baseline projector는 정밀 lineage engine을 대체하지 않고, `PipeStep.dataContract`, `PipeConnection`, `DataSchema.columns[*].facetRole`에서 읽을 수 있는 최소 skeleton만 생성한다.
- 이후 adapter 구현체가 이 인터페이스를 따르도록 확장한다.
