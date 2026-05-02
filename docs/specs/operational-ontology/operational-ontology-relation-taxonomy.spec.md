---
def:
  tier: component
  id: operational-ontology-relation-taxonomy
  type: spec
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-relation-category-schema
      type: traces_to
    - target: operational-ontology-core-model
      type: traces_to
    - target: meta-taxonomy
      type: traces_to
    - target: taxonomy-boundaries
      type: traces_to
---

# Operational Ontology Relation Taxonomy — relation type도 taxonomy여야 한다

## 목적 ^purpose

node 사이의 relation type을 문자열 label이나 보조 속성이 아니라 독립 taxonomy 교차점으로 다루는 규칙을 정의한다. RDF의 predicate vocabulary를 사람이 붙인 이름이 아닌 좌표화된 relation type identity로 승격하는 것이 목적이며, 그 relation type은 relation category schema를 통과한 뒤에만 runtime coordinate가 될 수 있다.

## 구성 ^overview

relation type은 아래 구조를 가진다.

- **category** — relation grammar의 루트
- **axes** — category가 허용한 세부 분류 축
- **canonicalKey** — relation type 자체의 정규화된 key

RelationTypeCoord는 다음 질문에 답한다.

- 이 관계 유형은 어떤 종류인가
- 그 유형은 어떤 강도/방향/효과를 가지는가
- 같은 이름처럼 보이는 유형이 실제로 동일한가

## 정의 ^defines

### relation type = taxonomy intersection

relation type은 아래 식으로 읽는다.

`RelationTypeCoord = category × axes`

따라서 relation type identity는:

- category와 axis 조합을 포함하며
- 동일한 의미는 동일한 canonicalKey로 수렴해야 한다

실제 start/end pair에 대한 연결 사실은 relation type이 아니라 edge가 담당한다.

### relation type category의 예

- `containment`
- `dependency`
- `constraint`
- `trace`
- `flow`
- `observation`

이 category는 최상위 enum이 아니라 relation type taxonomy의 root다. 실제 의미는 category 아래 axis 조합으로 더 정밀하게 정해진다.
