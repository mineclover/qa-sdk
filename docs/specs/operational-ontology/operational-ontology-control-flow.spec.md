---
def:
  tier: component
  id: operational-ontology-control-flow
  type: spec
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-information-transmission
      type: traces_to
    - target: operational-ontology-branch-handling
      type: traces_to
    - target: operational-ontology-simulation
      type: traces_to
    - target: meta-semantic-pipe-impl
      type: traces_to
  sources:
    - packages/operational-ontology/src/internal/runtime-core.ts
    - packages/operational-ontology/src/internal/pipe-projector.ts
    - packages/operational-ontology/src/internal/projector-utils.ts
    - packages/operational-ontology/src/projectors-pipe.test.ts
---

# Operational Ontology Control Flow — 제어 흐름 관리의 최소 모델

## 목적 ^purpose

제어 흐름 관리를 `operational-ontology`의 핵심 runtime 개념으로 정의한다. 목표는 control flow를 구현 세부로 보지 않고, 정보 전달과 분기 처리와 시뮬레이션을 묶는 상위 orchestration 모델로 다루는 것이다.

## 구성 ^overview

초기 control flow graph는 아래 요소를 가진다.

- `ControlFlowNode`
- `ControlFlowEdge`
- `ControlFlowGraph`

초기 node kind는 다음을 기준으로 둔다.

- `step`
- `sequence`
- `branch`
- `optional`
- `parallel`
- `join`
- `retry`
- `feedback`
- `emit`
- `transition_scope`

초기 edge kind는 다음을 기준으로 둔다.

- `next`
- `conditional`
- `event`
- `error`
- `fan_out`
- `join`
- `feedback`

## 정의 ^defines

### control flow의 역할

control flow는 아래를 관리한다.

- 어떤 node가 실행 가능한가
- 어떤 edge가 활성화되는가
- branch 이후 어떤 경로를 유지하는가
- feedback/retry/join이 simulation 결과에 어떤 영향을 주는가

### 기존 체계와의 연결

이 모델은 기존 `PipeGraph`를 대체하려는 것이 아니라, operational ontology에서 정보 전달과 계보를 해석할 때 필요한 최소 orchestration vocabulary를 제공한다. [pipe-spec.ts](../../../packages/core/src/types/pipe-spec.ts#L41)

### 현재 우선순위

지금 단계에서는 full engine보다:

1. control flow node/edge vocabulary
2. branch handling과의 연결
3. simulation 입력으로 쓰일 수 있는 최소 graph shape

를 먼저 고정하는 것이 중요하다.
