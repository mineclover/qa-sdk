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

## ECS-like Separation

Operational ontology pack authoring follows an ECS-like separation principle. This is a design philosophy, not a game-runtime dependency.

| ECS 역할 | Pack system 대응 | 규칙 |
|----------|------------------|------|
| Entity | `packId`, `axis.id`, `taxonomy.id`, `allocationId`, `artifactId`, `def.id` | 순수 식별자다. 상태와 행위를 넣지 않는다. |
| Component | `AxisSchema`, `TaxonomySchema`, `RelationCategorySchema`, `TraversalSchema`, registry/artifact records | 순수 데이터다. 숨은 로직을 넣지 않는다. |
| System | validator, allocator, projector, sync adapter, activation helper, docs graph traversal | Component를 읽고 변환하는 명시적 로직이다. 상태를 암묵적으로 소유하지 않는다. |

따라서 `OperationalOntologyPack`은 객체 상속 계층을 만들지 않는다. pack은 도메인 component vocabulary와 system binding을 조합하는 단위다.

pack authoring 원칙:

1. Entity id는 stable label이어야 하며 행위나 상태를 내포하지 않는다.
2. Component schema는 data-only 선언이어야 한다. 계산, I/O, registry mutation은 schema에 넣지 않는다.
3. System binding은 `blueprints`로 분리한다. implementation/test ref는 pack schema와 섞지 않는다.
4. pack validation은 선언된 component vocabulary와 system binding이 activation 전에 해석 가능한지 검증한다.
5. 성능 지향 SoA 저장 구조는 registry/index-meta storage 최적화의 참고 원칙일 뿐, pack interface의 즉시 구현 요구사항은 아니다.

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
