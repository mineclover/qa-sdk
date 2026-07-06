---
def:
  tier: component
  id: operational-ontology-relation-category-schema
  type: spec
  scope: data
  aspect: axis_catalog
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-relation-taxonomy
      type: constrains
    - target: operational-ontology-category-constraint
      type: constrains
    - target: operational-ontology-schema-validation
      type: traces_to
  sources:
    - packages/operational-ontology/src/internal/schema-core.ts
    - packages/operational-ontology/src/internal/schema-memory.ts
    - packages/operational-ontology/src/schema.ts
    - packages/operational-ontology/src/pack.test.ts
---

# Operational Ontology Relation Category Schema — relation type grammar의 schema 정의

## 목적 ^purpose

relation type category를 단순 이름 집합이 아니라 schema object로 선언하는 방식을 정의한다. 목표는 relation type space가 외부 registry에서 공급되더라도, category별 허용 축과 시작/끝 kind 제약을 같은 포맷으로 검증 가능하게 만드는 것이다.

## 구성 ^overview

relation category schema는 아래 요소를 가진다.

- `category`
- `requiredAxes`
- `optionalAxes`
- `forbiddenAxes`
- `defaultValues`
- `allowedStartKinds`
- `allowedEndKinds`
- `compositionRule`
- `validationRule`

이 schema는 relation type의 의미를 정의하지, 특정 edge assertion을 기록하지는 않는다.

## 정의 ^defines

### category schema의 역할

1. 어떤 축이 relation type identity에 참여하는지 정한다.
2. 어떤 축 조합이 금지되는지 정한다.
3. 어떤 node kind 사이에서 이 category가 성립 가능한지 제한한다.
4. relation type canonicalization 전에 검증 가능한 grammar를 제공한다.

### 외부 catalog와의 관계

category catalog의 SSOT는 외부에 있을 수 있다.

- JSON/YAML registry
- RDF vocabulary
- governance service
- definition catalog 기반 registry

`operational-ontology`는 이 catalog를 소유하지 않고, schema 포맷과 validation contract를 제공한다.
