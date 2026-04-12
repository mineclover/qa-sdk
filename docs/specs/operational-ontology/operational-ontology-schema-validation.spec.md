---
def:
  id: operational-ontology-schema-validation
  type: knowledge
  knowledge_kind: concept
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-taxonomy-schema
      type: depends_on
    - target: operational-ontology-relation-category-schema
      type: depends_on
    - target: operational-ontology-category-constraint
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/schema-core.ts
  - packages/operational-ontology/src/internal/schema-memory.ts
  - packages/operational-ontology/src/schema.ts
---

# Operational Ontology Schema Validation — taxonomy를 만들기 전에 검증하기

## 목적 ^purpose

taxonomy schema와 relation category schema를 runtime 사용 전에 검증하는 규칙을 정의한다. 목표는 schema drift, 중복 axis, 불가능한 조합, 외부 registry import 오류를 instance 생성 전에 차단하는 것이다.

## 구성 ^overview

schema validation은 세 단계로 나뉜다.

- **axis validation** — axis id, 값 중복, capacity, 최소 값 수
- **taxonomy validation** — axis 참조 무결성, identity axis 정합성, 중복 taxonomy id
- **relation/traversal validation** — relation category 축 중복, unknown axis, traversal purpose의 unknown category 참조

## 정의 ^defines

### validation plane

schema plane와 instance plane 사이에는 validation plane이 있어야 한다.

`Schema -> Validate -> Approve -> Runtime Coord`

이 순서를 지키지 않으면 taxonomy를 schema화한 의미가 사라진다.

### 최소 오류 유형

- `axis-id-duplicate`
- `axis-values-duplicate`
- `axis-capacity-too-small`
- `taxonomy-axis-missing`
- `taxonomy-identity-axis-missing`
- `relation-category-duplicate`
- `relation-axes-overlap`
- `traversal-relation-category-missing`

### 결과 모델

validation 결과는 최소한 아래를 포함해야 한다.

- `valid`
- `issues[]`
- `issue.level`
- `issue.code`
- `issue.path`
- `issue.message`
