---
def:
  tier: component
  id: operational-ontology-pipe-projector
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
    - target: operational-ontology-flow-corridor
      type: depends_on
    - target: operational-ontology-junction
      type: depends_on
    - target: operational-ontology-lineage
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/pipe-projector.ts
  - packages/operational-ontology/src/projectors-pipe.ts
---

# Operational Ontology Pipe Projector — PipeGraph 투영 표면

## 목적 ^purpose

`PipeGraph`를 corridor, control flow, junction, lineage skeleton으로 투영하는 공개 표면을 고정한다. 목표는 현재 시스템의 파이프 정의를 operational-ontology의 도로망 관점으로 읽을 수 있게 만드는 것이다.

## 구성 ^overview

pipe projector는 아래를 담당한다.

- `PipeGraph`를 `ControlFlowGraph`로 materialize
- `PipeStep.dataContract`를 `DataFlowDefinition`으로 materialize
- `PipeConnection`을 transmission skeleton과 flow link로 변환
- conditional connection을 `BranchDefinition`과 `JunctionDefinition`으로 변환
- optional `schemas/lineages`를 받아 schema-aware corridor를 생성

공개 진입점은 좁은 subpath로는 `operational-ontology/projectors/pipe`를 사용한다.

## 정의 ^defines

### 입력

- `PipeGraphProjectionInput`
  - `graph`
  - optional `schemas`
  - optional `lineages`
  - optional `CorridorTemplateRegistry`
  - optional `JunctionTemplateRegistry`

### 출력

- `PipeGraphProjectionResult`
  - `controlFlow`
  - `dataFlow`
  - `corridor`
  - `transmissions`
  - `lineageLinks`
  - `branchDefinitions`
  - `junctions`

### 경계

- pipe projector는 실제 runtime observation을 만들지 않는다.
- event-derived checkpoint는 만들지 않는다.
- path observation과의 결합은 snapshot orchestrator가 담당한다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-pipe.test.ts`
