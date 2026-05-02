---
def:
  tier: component
  id: operational-ontology-branch-handling
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
    - target: operational-ontology-simulation
      type: traces_to
    - target: meta-semantic-pipe-impl
      type: traces_to
    - target: tracking-three-axes
      type: traces_to
---

# Operational Ontology Branch Handling — 분기 처리의 해석 규칙

## 목적 ^purpose

분기 처리를 `operational-ontology`의 핵심 runtime 개념으로 정의한다. 목표는 branch를 단순 control statement로 보지 않고, 정보 전달과 계보가 여러 경로로 갈라지는 지점으로 해석하는 것이다.

## 구성 ^overview

분기 처리는 아래 요소를 가진다.

- `branch condition`
- `branch path`
- `handling mode`
- `branch decision`

handling mode의 초기 종류는 다음을 기준으로 둔다.

- `first_match`
- `all_matches`
- `fallback`
- `optional`

## 정의 ^defines

### branch의 역할

분기는 아래 질문에 답한다.

- 어떤 조건에서 경로가 갈라지는가
- 한 번에 몇 개 경로가 살아남는가
- 선택되지 않은 경로는 왜 버려졌는가
- branch 이후 lineage와 transmission은 어떻게 달라지는가

### 기존 체계와의 연결

기존 pipe flow의 `branch`, `optional`, `conditional connection`은 이미 제어 흐름을 다룬다. operational ontology의 branch handling은 그것을 정보 전달 관점으로 다시 읽는 것이다. [pipe-spec.ts](/Users/junwoobang/workflow/qa-sdk/packages/core/src/types/pipe-spec.ts#L141), [scenario.ts](/Users/junwoobang/workflow/qa-sdk/packages/core/src/types/scenario.ts#L17)

### 최소 우선순위

지금 단계에서 중요한 것은 branch 문법을 늘리는 것이 아니라:

1. 분기 조건
2. 분기 선택 모드
3. 선택 결과가 transmission과 lineage에 주는 영향

이 세 가지를 먼저 안정화하는 것이다.
