---
def:
  id: operational-ontology-system
  type: spec
  tier: system
  level: group
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: draft
  layer: domain
  svc: operational-ontology
  tags: [entry-point, structural, cross-scope]
  links:
    - target: taxonomy-boundaries
      type: traces_to
    - target: meta-taxonomy
      type: traces_to
    - target: dual-coordinate-system
      type: traces_to
    - target: operational-ontology-component-plane
      type: contains
    - target: operational-ontology-interface-plane
      type: contains
    - target: operational-ontology-behavior-plane
      type: contains
    - target: operational-ontology-observation-plane
      type: contains
    - target: operational-ontology-governance-plane
      type: contains
---

# Operational Ontology System — schema-first operational ontology 초안

## 목적 ^purpose

taxonomy를 먼저 schema로 선언하고 검증한 뒤, 그 schema에서 node, relation type, edge, traversal coordinate를 생성하는 operational ontology 초안을 정의한다. 목표는 RDF 스타일의 그래프 표현 위에 정보 축을 추가하되, taxonomy와 relation type이 임의 vocabulary로 흩어지지 않도록 schema-first validation으로 안정적인 운영 경계를 만드는 것이다.

## 구성 ^overview

이 시스템은 E/C/I/S + L/P 책임으로 5개 plane을 갖는다.

- `operational-ontology-component-plane`: schema, taxonomy, relation, traversal, data facet, persistence vocabulary.
- `operational-ontology-interface-plane`: pack/runtime/web/package interface와 external bridge.
- `operational-ontology-behavior-plane`: schema validation, implementation governance, prompt artifact, simulation/control behavior.
- `operational-ontology-observation-plane`: corridor, junction, checkpoint, transmission, lineage, branch/control observation semantics.
- `operational-ontology-governance-plane`: validation boundary, design-change matrix, definition graph requirements, registry allocation roadmap.

RDF bridge와 programming artifact ontology는 이 system의 direct ownership이 아니라 interface/governance plane을 통해 참조한다.

초안의 기준 원칙은 다음과 같다.

1. taxonomy는 runtime 전에 schema로 선언되고 검증되어야 한다.
2. 정보의 최소 안정 identity는 node anchor와 taxonomy 교차점으로 결정한다.
3. relation type은 보조 속성이 아니라 독립 taxonomy여야 한다.
4. edge는 relation type이 특정 node pair에서 성립한 assertion이다.
5. traversal은 질의 부산물이 아니라 목적 기반 coordinate가 될 수 있다.
6. category가 relation type 축의 허용 집합을 제한하여 조합 폭발을 막는다.
7. category catalog는 패키지 내부가 아니라 외부 registry에서 관리할 수 있다.
8. document와 path는 ontology 본체가 아니라 projection일 수 있다.
9. 현재 내부 안정화 우선순위는 schema 세부화보다 data facet, flow corridor, checkpoint observation, semantic transmission, lineage, junction/branch handling, control-flow management, simulation에 둔다.

## 정의 ^defines

이 패키지가 다루는 operational ontology의 범위:

- axis/taxonomy schema 정의와 검증
- 도메인 pack 단위 schema/governance/blueprint 검증
- 작업영역별 prompt artifact 생성과 검증
- relation category schema와 traversal schema 정의
- node identity canonicalization
- relation type taxonomy와 category root
- edge assertion과 traversal route
- relation type axis validation과 defaulting
- traversal coordinate와 purpose projection
- facet bundle 기반 persistence 모델, object/facet 허용 매트릭스, required facet 규칙, payload shape 규칙
- data facet, corridor, checkpoint, information transmission, lineage, junction/branch handling, control-flow management, simulation 해석층
- RDF URI/triple/path 대응
- canonical identity와 derived coordinate의 구분

## 위임 ^delegates

- `operational-ontology-component-plane` — Component vocabulary plane
- `operational-ontology-interface-plane` — Interface/Pack/Layout plane
- `operational-ontology-behavior-plane` — System behavior plane
- `operational-ontology-observation-plane` — observation semantics plane
- `operational-ontology-governance-plane` — validation/governance plane
