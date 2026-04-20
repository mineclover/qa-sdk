---
def:
  tier: component
  id: operational-ontology-edge-assertion
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-core-model
      type: depends_on
    - target: operational-ontology-relation-taxonomy
      type: depends_on
---

# Operational Ontology Edge Assertion — relation type의 실제 연결 사실

## 목적 ^purpose

relation type 자체와, 특정 start/end node 사이에 그 relation type이 성립했다는 실제 assertion을 분리한다. 목표는 relation vocabulary와 graph fact를 같은 좌표로 섞지 않고, edge를 독립 primitive로 다루는 것이다.

## 구성 ^overview

EdgeCoord는 아래 요소로 구성한다.

- `start` — 시작 node identity
- `relationType` — 적용되는 relation type identity
- `end` — 도착 node identity
- `canonicalKey` — assertion 자체의 정규화된 key

핵심은 relation type이 관계의 의미를 정의하고, edge는 그 의미가 특정 두 node 사이에서 성립한다는 사실을 기록한다는 점이다.

## 정의 ^defines

### edge = assertion primitive

edge는 아래 식으로 읽는다.

`NodeCoord(start) -- RelationTypeCoord --> NodeCoord(end)`

이때:

- relation type은 vocabulary다
- edge는 assertion이다
- 같은 relation type이 여러 edge에 재사용될 수 있다

### 왜 분리해야 하는가

relation type과 edge를 합치면:

- relation 의미와 관계 사실이 섞인다
- RDF predicate와 triple의 차이가 사라진다
- traversal이 relation chain인지 edge chain인지 불명확해진다

따라서 operational ontology는 relation type과 edge를 각각 독립 primitive로 취급한다.
