---
def:
  id: operational-ontology-pack-interface
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-taxonomy-schema
      type: depends_on
    - target: operational-ontology-production-factory
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/pack-core.ts
  - packages/operational-ontology/src/pack.ts
---

# Operational Ontology Pack Interface — 도메인 온톨로지 pack 검증 표면

## 목적 ^purpose

도메인별 operational ontology 확장을 schema, implementation governance taxonomy, blueprint 묶음으로 선언하고 한 번에 검증하는 pack 인터페이스를 정의한다. 목표는 authorization, infra, event 같은 도메인 온톨로지가 같은 단위로 등록·검증·확장되게 만드는 것이다.

## 구성 ^overview

`OperationalOntologyPack`은 다음을 가진다.

- `packId`
- `schema`
- `governanceTaxonomy?`
- `blueprints?`
- `metadata?`

pack 검증은 세 결과를 조합한다.

- `validateOperationalOntologySchema(pack.schema)`
- `validateImplementationGovernanceTaxonomy(pack.governanceTaxonomy)`
- `validateImplementationBlueprint(blueprint, pack.schema, pack.governanceTaxonomy)`

## 정의 ^defines

pack은 새로운 schema 문법을 만들지 않는다. 기존 schema plane과 governance plane을 도메인 단위로 묶는 composition surface다.

검증 규칙:

1. `packId`는 비어 있으면 안 된다.
2. schema validation error는 pack validation error가 된다.
3. governance taxonomy validation error는 pack validation error가 된다.
4. blueprint id는 pack 안에서 중복될 수 없다.
5. blueprint의 `requiredSchemas`는 pack schema 안에서 해소되어야 한다.

public surface:

- `operational-ontology/pack`
- `operationalOntologyPackPlane.validateOperationalOntologyPack()`
- `operationalOntologyPackPlane.validateOperationalOntologyPacks()`
- `InMemoryOperationalOntologyPackRegistry`

registry 규칙:

1. pack registry는 pack 목록 조회와 id 기반 조회를 제공한다.
2. `validateAll()`은 pack id 중복과 각 pack 내부 검증 결과를 함께 반환한다.
3. registry는 pack 내용을 직접 수정하지 않고, pack validation 결과만 제공한다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/pack.test.ts`
