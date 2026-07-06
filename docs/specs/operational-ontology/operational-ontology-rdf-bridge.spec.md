---
def:
  tier: component
  id: operational-ontology-rdf-bridge
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-core-model
      type: traces_to
    - target: operational-ontology-relation-taxonomy
      type: traces_to
    - target: operational-ontology-traversal-coordinate
      type: traces_to
  sources:
    - packages/operational-ontology/src/internal/runtime-core.ts
    - packages/operational-ontology/src/internal/schema-core.ts
    - packages/operational-ontology/src/runtime.ts
---

# Operational Ontology RDF Bridge — RDF 개념을 operational coordinate로 읽기

## 목적 ^purpose

RDF의 subject/predicate/object와 graph 개념을 operational ontology에 어떻게 포함할지 정의한다. 목표는 RDF를 버리는 것이 아니라, RDF의 정체성과 관계 표현을 유지한 채 schema plane과 runtime plane을 갖는 operational layer를 얹는 것이다.

## 구성 ^overview

Operational ontology와 RDF의 기본 대응은 아래와 같다.

| Operational Ontology | RDF 대응 | 설명 |
|---|---|---|
| `NodeCoord.anchor` | URI / IRI | 리소스의 최소 안정 identity |
| `NodeCoord.taxonomies` | vocabulary 적용 결과 | 같은 리소스를 어떤 taxonomy 교차점으로 읽는가 |
| `RelationTypeCoord` | predicate vocabulary | predicate를 relation type taxonomy로 정밀화한 좌표 |
| `EdgeCoord` | triple assertion | subject-predicate-object 사실 자체 |
| `TraversalCoord` | property path / named traversal | edge chain을 route identity 후보로 취급 |
| `space` | named graph / context | 어떤 의미 공간에서 읽는가 |

핵심 차이는 RDF가 주로 node와 triple을 first-class로 다루는 반면, operational ontology는 relation type과 traversal도 first-class coordinate로 다룬다는 점이다.

## 정의 ^defines

### RDF 포함 원칙

1. RDF의 URI/IRI는 node anchor로 수용할 수 있다.
2. RDF predicate는 relation type taxonomy category와 axis 조합으로 해석할 수 있다.
3. RDF triple은 `NodeCoord -- RelationTypeCoord --> NodeCoord`가 아니라 `EdgeCoord(start, relationType, end)`로 보존된다.
4. RDF property path는 traversal coordinate 후보가 될 수 있다.
5. RDF vocabulary는 taxonomy seed나 외부 category catalog의 입력으로 사용할 수 있다.
6. RDF에서 가져온 vocabulary도 runtime 사용 전에 taxonomy schema validation을 통과해야 한다.

### 경계

이 패키지는 RDF 저장소나 SPARQL 엔진을 대체하지 않는다.

- RDF 저장/질의는 외부 graph system이 맡는다.
- `operational-ontology`는 그 위에 operational coordinate와 validation grammar를 얹는다.
- canonical relation category catalog도 패키지 내부 SSOT로 두지 않고 외부 registry에서 공급받는다.

즉 이 패키지는 RDF 엔진이 아니라 RDF 친화적인 좌표 framework다.
