---
def:
  tier: component
  id: operational-ontology-taxonomy-schema
  type: spec
  scope: data
  aspect: prefix_schema
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-core-model
      type: constrains
    - target: operational-ontology-schema-validation
      type: traces_to
  sources:
    - packages/operational-ontology/src/internal/schema-core.ts
    - packages/operational-ontology/src/internal/schema-memory.ts
    - packages/operational-ontology/src/schema.ts
    - packages/operational-ontology/src/pack.test.ts
---

# Operational Ontology Taxonomy Schema — taxonomy를 정의하기 위한 schema plane

## 목적 ^purpose

taxonomy 자체를 runtime coordinate보다 먼저 선언 가능한 schema로 정의한다. 목표는 ontology instance를 만들기 전에 axis, taxonomy, identity axis, 적용 대상 kind를 명시하고, 이를 기계적으로 검증할 수 있게 하는 것이다.

## 구성 ^overview

taxonomy schema plane의 기본 단위는 다음과 같다.

- **AxisSchema** — 축 id, 유한 값 집합, 안정성, extensible 여부, capacity
- **TaxonomySchema** — 어떤 axis들을 조합해 하나의 taxonomy를 이루는지
- **identityAxisIds** — taxonomy 중 canonical identity에 직접 참여하는 축
- **appliesTo** — 어떤 node kind나 대상 kind에 이 taxonomy가 적용되는지

이 층이 없으면 taxonomy는 단순 vocabulary 모음이 되고, 외부 catalog를 받아도 운용 가능한 ontology로 승격할 수 없다.

## 정의 ^defines

### schema-first 원칙

1. taxonomy는 먼저 schema로 선언되어야 한다.
2. runtime instance는 승인된 schema를 통과한 뒤에만 생성할 수 있다.
3. identity에 참여하는 축과 단순 보조 축을 분리해야 한다.
4. 외부 RDF vocabulary나 catalog를 가져오더라도 schema plane을 통과해야 한다.

### 최소 schema 구성

하나의 taxonomy schema는 최소한 다음을 알아야 한다.

- taxonomy id
- axis 목록
- identity axis 목록
- 적용 대상
- 의미 공간(space) 또는 realm 경계
