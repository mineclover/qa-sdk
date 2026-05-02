---
def:
  tier: component
  id: operational-ontology-flow-corridor
  type: spec
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-data-facets
      type: traces_to
    - target: operational-ontology-information-transmission
      type: traces_to
    - target: operational-ontology-control-flow
      type: traces_to
sources:
  - packages/operational-ontology/src/internal/corridor-core.ts
---

# Operational Ontology Flow Corridor — 데이터가 지나가는 통로 정의

## 목적 ^purpose

`operational-ontology`에서 데이터 흐름을 단순 연결 그래프가 아니라 **지나가야 하는 통로(corridor)**로 정의한다. 목표는 어떤 데이터가 어디서 진입하고, 어떤 계약과 전달 semantics를 거쳐, 어디로 빠져나가는지를 일관된 구조로 설명하는 것이다.

## 구성 ^overview

현재 구현에서 corridor는 `DataFlowDefinition`으로 표현하고, `CorridorTemplateRegistry`를 통해 materialize된다.

- `flowId`
- `entryNodeId`
- `templateKind`
- `templateDescription`
- `templateValidation`
- `nodeIds`
- `schemaIds`
- `endpoints`
- `contracts`
- `links`

이 구조는 도로망 비유에서 다음에 대응한다.

- `endpoints` — 진입로/진출로
- `contracts` — 차선 규칙과 통행 가능 데이터
- `links` — 실제 연결 구간
- `schemaIds` — 이 통로에서 다루는 데이터 종류
- `templateValidation` — 이 통로가 template가 허용한 endpoint/contract/link shape를 만족하는가

## 정의 ^defines

### corridor의 역할

corridor는 아래 질문에 답한다.

- 어떤 데이터가 이 흐름에 진입하는가
- 어떤 경유점과 계약이 있는가
- 어떤 링크를 통해 다음 구간으로 이동하는가
- 이 흐름이 어떤 schema를 다루는가

### 현재 구현과의 대응

- type alias: `FlowCorridor = DataFlowDefinition`
- `PipeGraph projector` 결과: `corridor`
- `EventRecord projector` 결과: synthetic observed corridor
- custom corridor template registry를 주입하면 `templateDescription` 같은 materialized metadata가 달라질 수 있다
- custom corridor template registry를 주입하면 `allowed/required endpoint/contract/link` 규칙에 따라 `templateValidation`도 달라질 수 있다

즉 corridor는 설계 시점에도 존재하고, 관측 시점에도 synthetic하게 형성될 수 있다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-pipe.test.ts`, `packages/operational-ontology/src/projectors-event.test.ts`
