---
def:
  id: operational-ontology-event-projector
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
    - target: operational-ontology-checkpoint
      type: depends_on
    - target: operational-ontology-flow-corridor
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/event-projector.ts
  - packages/operational-ontology/src/projectors-event.ts
---

# Operational Ontology Event Projector — EventRecord 관측 투영 표면

## 목적 ^purpose

`EventRecord`를 corridor와 checkpoint lattice로 투영하는 공개 표면을 고정한다. 목표는 event 관측이 단순 로그 해석이 아니라, corridor 위의 checkpoint 관측으로 일관되게 해석되게 만드는 것이다.

## 구성 ^overview

event projector는 아래를 담당한다.

- `EventRecord + address_context`를 synthetic observed corridor로 materialize
- payload가 object면 top-level field를 `payload_field` endpoint로 분해
- `address_context` binding을 `address_binding` endpoint와 checkpoint로 materialize
- root/payload/binding checkpoint를 포함한 `CheckpointLattice` 생성

공개 진입점은 좁은 subpath로는 `operational-ontology/projectors/event`를 사용한다.

## 정의 ^defines

### 입력

- `EventRecordObservationInput`
- optional `AddressContextBinding[]`
- optional `CheckpointTemplateRegistry`
- optional `CorridorTemplateRegistry`

### 출력

- `EventRecordProjectionResult`
  - `dataFlow`
  - `transmissions`
  - `checkpoint`
  - `checkpoints`
  - `checkpointDefinitions`
  - `checkpointLattice`

### 경계

- event projector는 route decision을 직접 만들지 않는다.
- route decision checkpoint 추가는 snapshot orchestrator 단계에서 수행한다.
- event projector는 synthetic observed corridor를 만들지만, graph-level corridor와의 결합은 상위 snapshot이 담당한다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-event.test.ts`
