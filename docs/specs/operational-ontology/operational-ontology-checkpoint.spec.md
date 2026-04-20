---
def:
  tier: component
  id: operational-ontology-checkpoint
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, observability]
  links:
    - target: operational-ontology-runtime-interface
      type: depends_on
    - target: observability-taxonomy
      type: depends_on
    - target: operational-ontology-persistence
      type: refines
sources:
  - packages/operational-ontology/src/internal/checkpoint-core.ts
---

# Operational Ontology Checkpoint — 통로 위 관측 지점 정의

## 목적 ^purpose

`operational-ontology`에서 관측을 임의 로그 수집이 아니라 **corridor 위의 checkpoint 관측**으로 정의한다. 목표는 같은 종류의 데이터가 같은 통로를 지나갈 때, 항상 같은 checkpoint에서 같은 의미로 기록되게 만드는 것이다.

## 구성 ^overview

현재 구현에서 checkpoint는 두 층과 하나의 lattice로 표현한다.

- `CheckpointDefinition`
  - 어떤 node에서 무엇을 관측할 것인가
- `CheckpointObservation`
  - 특정 record가 그 checkpoint에서 어떻게 관측되었는가
- `CheckpointLattice`
  - root checkpoint와 payload/binding checkpoint를 하나의 corridor 위 구조로 묶음

`EventRecord projector`는 `address_context`를 읽어 synthetic `CheckpointObservation`과 `CheckpointLattice`를 만든다. 이때 checkpoint definition과 link relation은 checkpoint template registry를 통해 materialize할 수 있다.
runtime snapshot에서는 checkpoint가 추가로 아래 참조를 가질 수 있다.

- `corridorId`
- `junctionId`
- `traversalKey`

## 정의 ^defines

### checkpoint의 역할

checkpoint는 아래 질문에 답한다.

- 이 관측은 어떤 통로 위의 어느 지점에서 찍힌 것인가
- 어떤 prefix/address binding을 관측했는가
- 어떤 node와 edge가 관측되었는가
- 관측 결과를 corridor/dataFlow와 어떻게 연결할 것인가
- 이 checkpoint가 어떤 junction 판단과 어떤 traversal에 붙는가

### CCTV 비유

checkpoint는 도로 위 CCTV와 같다.

- corridor가 도로를 정의한다
- junction가 교차로를 정의한다
- checkpoint는 지나간 사실을 같은 기준으로 찍는다

그래서 관측은 corridor 바깥의 독립 로그가 아니라, corridor 위에서 발생한 observation으로 읽어야 한다.

### checkpoint lattice

현재 baseline 구현은 다음 3종 checkpoint를 두고, snapshot 합성 시 route decision checkpoint가 추가될 수 있다.

- root checkpoint
- payload field checkpoint
- address binding checkpoint
- route decision checkpoint (snapshot phase)

즉 하나의 record가 하나의 checkpoint만 만드는 것이 아니라, 같은 corridor 위에서 여러 관측 지점을 lattice로 형성한다.

checkpoint template는 현재 아래 shape contract를 가질 수 있다.

- `relationToParent`
- `requireObservedFields`
- `requireObservedPrefixIds`
- `requireObservedNodeHit`

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-event.test.ts`, `packages/operational-ontology/src/projectors-snapshot.test.ts`
