---
def:
  id: operational-ontology-simulation
  type: knowledge
  knowledge_kind: concept
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, testing]
  links:
    - target: operational-ontology-data-facets
      type: depends_on
    - target: operational-ontology-information-transmission
      type: depends_on
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: tracking-three-axes
      type: depends_on
---

# Operational Ontology Simulation — 정보 패싯과 전달을 시뮬레이션하기

## 목적 ^purpose

`operational-ontology`에서 시뮬레이션을 schema 검증의 부속 기능이 아니라 핵심 해석 도구로 정의한다. 목표는 정보의 facet bundle과 전달 semantics를 실제 관측 전에 가상 실행해보고, 어떤 facet이 도달하고 어떤 경로가 살아남는지 확인하는 것이다.

## 구성 ^overview

시뮬레이션은 아래 입력을 사용한다.

- data facet bundle
- transmission edge set
- traversal purpose
- 시작 정보 또는 시작 이벤트
- 기대 결과

출력은 아래를 가진다.

- 도달한 facet
- 활성화된 edge
- 선택된 traversal
- 누락된 전달
- drift 후보

## 정의 ^defines

### 시뮬레이션이 먼저인 이유

현재 단계에서 schema를 세밀하게 확정해도, 정보가 실제로 어떻게 이동하는지와 어떤 facet이 도달 가능한지가 불명확하면 taxonomy는 금방 흔들린다.

반대로 시뮬레이션을 먼저 고도화하면:

- 어떤 구분이 실제로 필요한지
- 어떤 edge가 의미 없는지
- 어떤 traversal purpose가 독립적인지
- 어떤 schema 항목이 과한지

를 역으로 판정할 수 있다.

### 기존 체계와의 연결

기존 meta-semantic의 pipe simulation은 이미 “무엇이 함께 실행되는가”를 다룬다. operational ontology의 simulation은 여기에 “무엇이 facet로 전달되는가”를 덧붙인 해석층이 된다. [meta-semantic-pipe-impl.spec.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-pipe-impl.spec.md#L54), [tracking-three-axes.spec.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/system/tracking-three-axes.spec.md#L128)

### 최소 검증 질문

1. 이 정보는 definition에서 production까지 도달하는가
2. 생산된 정보는 소비 지점까지 도달하는가
3. storage projection은 core data를 훼손하지 않는가
4. observation emission은 전달 결과를 충분히 보존하는가
5. 어떤 facet이 누락되면 전체 전달이 끊기는가

### 우선순위

내부 안정화의 현재 우선순위는:

1. data facet 모델
2. information transmission semantics
3. simulation model
4. 그 다음 schema 세부화

즉 schema는 여전히 필요하지만, 지금은 simulation이 schema refinement를 이끌어야 한다.
