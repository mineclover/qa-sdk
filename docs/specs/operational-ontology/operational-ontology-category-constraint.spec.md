---
def:
  id: operational-ontology-category-constraint
  type: knowledge
  knowledge_kind: concept
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-relation-taxonomy
      type: depends_on
    - target: operational-ontology-core-model
      type: depends_on
---

# Operational Ontology Category Constraint — relation 조합 폭발을 막는 grammar

## 목적 ^purpose

relation type taxonomy가 무제한 axis 조합으로 폭발하지 않도록, category가 허용하는 축 집합과 기본값, 금지 규칙을 명시하는 category-constrained grammar를 정의한다.

## 구성 ^overview

각 relation type category는 아래 메타데이터를 가져야 한다.

- `requiredAxes`
- `optionalAxes`
- `forbiddenAxes`
- `defaultValues`
- `allowedStartKinds`
- `allowedEndKinds`
- `compositionRule`
- `validationRule`

이 메타데이터는 relation type category를 단순 분류가 아니라 작은 닫힌 문법으로 만든다.

category catalog의 실제 저장과 배포는 이 패키지의 책임이 아니다. 패키지는 relation type category를 해석하고 검증하는 framework를 제공하고, category catalog 자체는 외부 registry, 파일, RDF vocabulary, 혹은 다른 governance 시스템이 공급할 수 있다.

## 정의 ^defines

### category-constrained taxonomy

category가 허용한 축만 relation type identity에 참여할 수 있다.

- 같은 category라도 허용 축이 다르면 다른 category로 분리한다.
- 한 번만 필요한 차이는 axis 추가가 아니라 annotation/property로 처리한다.
- 새 relation type이 기존 category 안에서 표현 가능하면 새 category를 만들지 않는다.

### 운영 규칙

1. category 추가는 node taxonomy 추가보다 더 엄격해야 한다.
2. required axis가 없으면 category를 canonical relation type으로 채택하지 않는다.
3. optional axis는 의미를 정밀화할 뿐, category의 본질을 바꾸면 안 된다.
4. forbidden axis가 필요해지는 순간 category 설계가 틀렸다고 본다.
5. validation은 relation type canonicalKey 생성 전에 수행한다.
6. framework와 catalog SSOT를 분리한다. 패키지는 grammar와 validation을 제공하고, category 목록은 외부에서 주입한다.

### 예시

`dependency` category:

- required: `kind`, `strength`
- optional: `direction`, `lifecycle`
- forbidden: `evidence_kind`

`trace` category:

- required: `evidence_kind`
- optional: `granularity`, `stability`
- forbidden: `failure_mode`
