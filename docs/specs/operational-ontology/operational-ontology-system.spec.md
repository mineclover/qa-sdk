---
def:
  id: operational-ontology-system
  type: knowledge
  knowledge_kind: concept
  level: group
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [entry-point, structural, cross-scope]
  links:
    - target: taxonomy-boundaries
      type: depends_on
    - target: meta-taxonomy
      type: depends_on
    - target: dual-coordinate-system
      type: depends_on
    - target: operational-ontology-taxonomy-schema
      type: contains
    - target: operational-ontology-relation-category-schema
      type: contains
    - target: operational-ontology-schema-validation
      type: contains
    - target: operational-ontology-validation-boundary
      type: contains
    - target: operational-ontology-design-change-validation-matrix
      type: contains
    - target: operational-ontology-definition-graph-requirements
      type: contains
    - target: operational-ontology-allocation-validation-contract
      type: contains
    - target: operational-ontology-registry-persistence-handoff
      type: contains
    - target: operational-ontology-index-meta-sync-handoff
      type: contains
    - target: operational-ontology-scoped-prefix-decision
      type: contains
    - target: operational-ontology-pack-interface
      type: contains
    - target: operational-ontology-production-factory
      type: contains
    - target: operational-ontology-prompt-artifact-generation
      type: contains
    - target: operational-ontology-persistence
      type: contains
    - target: operational-ontology-data-facets
      type: contains
    - target: operational-ontology-flow-corridor
      type: contains
    - target: operational-ontology-junction
      type: contains
    - target: operational-ontology-checkpoint
      type: contains
    - target: operational-ontology-observation-topology
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
    - target: operational-ontology-runtime-interface
      type: contains
    - target: operational-ontology-package-architecture
      type: contains
    - target: operational-ontology-visualization-web
      type: contains
    - target: operational-ontology-core-model
      type: contains
    - target: operational-ontology-relation-taxonomy
      type: contains
    - target: operational-ontology-edge-assertion
      type: contains
    - target: operational-ontology-category-constraint
      type: contains
    - target: operational-ontology-traversal-coordinate
      type: contains
    - target: operational-ontology-rdf-bridge
      type: contains
    - target: programming-artifact-ontology-system
      type: contains
    - target: operational-ontology-registry-allocation-plan
      type: contains
    - target: operational-ontology-registry-allocation-todo
      type: contains
    - target: operational-ontology-ssot-navigation-guide
      type: contains
---

# Operational Ontology System — schema-first operational ontology 초안

## 목적 ^purpose

taxonomy를 먼저 schema로 선언하고 검증한 뒤, 그 schema에서 node, relation type, edge, traversal coordinate를 생성하는 operational ontology 초안을 정의한다. 목표는 RDF 스타일의 그래프 표현 위에 정보 축을 추가하되, taxonomy와 relation type이 임의 vocabulary로 흩어지지 않도록 schema-first validation으로 안정적인 운영 경계를 만드는 것이다.

## 구성 ^overview

이 시스템은 schema plane, validation plane, implementation governance plane, instance plane, persistence plane 위에 현재 우선순위로 `corridor / junction / checkpoint` 관점의 해석층을 올리는 구조로 구성된다.

- **Schema plane**
  - `AxisSchema` — 축 정의
  - `TaxonomySchema` — taxonomy 정의
  - `RelationCategorySchema` — relation type grammar 정의
  - `TraversalSchema` — purpose별 route family 정의
- **Validation plane**
  - schema 무결성, axis 중복, unknown reference, category overlap 검증
  - ontology design 변경 전 확인해야 하는 local/system validation boundary
  - ontology design 변경 종류별 문서/소유 경계/테스트/명령 matrix
  - ontology module/leaf/plan/todo/knowledge 문서 graph requirement
  - allocation plan projection/validation 불변조건을 고정하는 local contract
- **Pack plane**
  - schema, governance taxonomy, blueprint를 도메인 pack 단위로 묶고 한 번에 검증
- **Implementation governance plane**
  - 승인된 schema와 taxonomy 좌표를 구현/검증 binding과 consistency constraint로 매칭하는 거버넌스 계약
- **Prompt artifact plane**
  - governance evidence에서 작업영역별 `self_reflection` / `code_editing_rules`를 생성하는 파생 산출물 표면
- **Programming artifact plane**
  - build/generated/quality/deploy/prompt 산출물을 artifact registry provider로 해석하는 pack schema
- **Registry allocation plane**
  - schema allocation plan을 namespace/axis/taxonomy/address allocation record로 투영하고 registry-service/index-meta 승격 경계를 준비
  - registry-service persistence가 시작할 때 소비할 namespace/axis/taxonomy/allocation/segment record handoff 계약
  - active allocation을 index-meta prefix registry/schema version record로 materialize할 sync handoff 계약
  - scoped prefix가 필요한 concrete evidence와 registry/index-meta/decode migration surface를 결정하는 prefix policy gate
- **Instance plane**
  - `NodeCoord`
  - `RelationTypeCoord`
  - `EdgeCoord`
  - `TraversalCoord`
- **Persistence plane**
  - schema store
  - registry store
  - assertion store
  - observation log
  - rebuildable projection store
- **Interpretation priority**
  - data facet model
  - flow corridor
  - checkpoint observation
  - information transmission semantics
  - data lineage tracking
  - junction / branch handling
  - control-flow management
  - simulation model
- **Runtime interface**
  - `operational-ontology-runtime-interface` module 아래에서 Event / Pipe / Path / Snapshot projector family로 세분화

RDF bridge는 이 4층 전체에 대응되는 외부 의미 계층이다.

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

- `operational-ontology-taxonomy-schema` — axis/taxonomy를 schema plane으로 선언하는 규칙
- `operational-ontology-relation-category-schema` — relation type category schema 정의
- `operational-ontology-schema-validation` — schema plane과 instance plane 사이의 검증 규칙
- `operational-ontology-validation-boundary` — ontology design 변경의 문서/패키지/시뮬레이션/registry lifecycle 검증 경계
- `operational-ontology-design-change-validation-matrix` — axis/taxonomy/relation/allocation/definition/pack activation 변경별 검증 경로
- `operational-ontology-definition-graph-requirements` — ontology module/leaf/plan/todo/knowledge 문서의 frontmatter, contains, split, sources 규칙
- `operational-ontology-allocation-validation-contract` — registry persistence가 보존해야 하는 local allocation 불변조건
- `operational-ontology-registry-persistence-handoff` — registry-service persistence가 소비할 record mapping, collision rule, future test 계약
- `operational-ontology-index-meta-sync-handoff` — active allocation의 index-meta sync input, materialization, idempotency, smoke check 계약
- `operational-ontology-scoped-prefix-decision` — global prefix uniqueness 유지와 scoped prefix 도입을 가르는 Phase 6 decision criteria
- `operational-ontology-pack-interface` — schema/governance/blueprint를 pack 단위로 묶는 인터페이스
- `operational-ontology-prompt-artifact-generation` — 작업영역별 prompt artifact 생성과 검증 규칙
- `operational-ontology-persistence` — schema/registry/assertion/observation/projection 저장 모델
- `operational-ontology-data-facets` — 정보를 canonical data facet bundle로 읽는 원칙
- `operational-ontology-flow-corridor` — 데이터가 지나가는 통로를 정의하는 원칙
- `operational-ontology-junction` — 갈림길과 합류 지점을 정의하는 원칙
- `operational-ontology-checkpoint` — corridor 위 관측 지점을 정의하는 원칙
- `operational-ontology-observation-topology` — corridor/junction/checkpoint 상위 배치 계약
- `operational-ontology-information-transmission` — 정보 전달을 edge semantics로 읽는 원칙
- `operational-ontology-lineage` — 정보 facet 사이의 계보 추적 원칙
- `operational-ontology-branch-handling` — 분기 처리의 해석 규칙
- `operational-ontology-control-flow` — 제어 흐름 관리의 최소 vocabulary
- `operational-ontology-simulation` — facet과 transmission을 시뮬레이션하는 원칙
- `operational-ontology-runtime-interface` — 현재 시스템 입력을 operational-ontology 해석층으로 투영하는 운영 포트
  projector family leaf:
  `operational-ontology-event-projector`, `operational-ontology-pipe-projector`, `operational-ontology-path-projector`, `operational-ontology-snapshot-projector`
- `operational-ontology-package-architecture` — plane별 공개 facade와 패키지 경계
- `operational-ontology-core-model` — NodeCoord와 anchor/canonical identity 모델
- `operational-ontology-relation-taxonomy` — relation type을 taxonomy로 다루는 원칙
- `operational-ontology-edge-assertion` — relation type이 node 사이에서 성립한 assertion 모델
- `operational-ontology-category-constraint` — category-constrained grammar와 운영 규칙
- `operational-ontology-traversal-coordinate` — route identity와 purpose projection
- `operational-ontology-rdf-bridge` — RDF와 operational coordinate의 대응 규칙
- `programming-artifact-ontology-system` — build/generated/quality/deploy/prompt 산출물 vocabulary와 registry provider pack
- `operational-ontology-registry-allocation-plan` — ontology-aware registry/address allocation 로드맵
- `operational-ontology-registry-allocation-todo` — registry allocation 구현 체크리스트
- `operational-ontology-ssot-navigation-guide` — schema/registry/address/observation SSOT 탐색 순서
