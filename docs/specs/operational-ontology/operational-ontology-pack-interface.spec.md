---
def:
  tier: component
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

## Authoring Rules

Pack authoring 소비 규칙은 `operational-ontology-pack-interface-rule`이 소유한다. 이 spec은 `OperationalOntologyPack`의 현재 contract와 검증 표면을 정의하고, rule 문서는 architecture-neutral Entity / Component / System-informed separation, scaffold/validate policy, known-pack candidate, source-map candidate 같은 반복 적용 규칙을 고정한다.

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

## Pack Authoring CLI Contract

`OperationalOntologyPack` remains the canonical pack contract. Authoring tools must create or validate artifacts against this interface instead of introducing a parallel pack schema.

CLI surfaces:

- `qa-sdk ontology pack scaffold <pack-id>` is the primary pack authoring scaffold surface.
- `qa-sdk ontology pack validate <pack-ref>` is the validation surface for known pack ids or supported pack references.

Pack id naming rules:

1. `pack-id` must be a safe kebab-case entity id: lowercase alphanumeric words separated by `-`, starting with a letter.
2. `pack-id` must not contain spaces, underscores, path separators, dots, or scoped package syntax.
3. The id should name the ontology domain and normally end in `-ontology`, as in `programming-artifact-ontology` and `authorization-ontology`.

Scaffold and write policy:

1. Scaffold is dry-run by default. A scaffold invocation plans implementation files, tests, definition docs, source-map candidates, and known-pack registration candidates before any write.
2. File writes require explicit `--write`.
3. Write mode materializes only planned scaffold files. It does not overwrite existing files and it still leaves resolver/source-map edits as candidates.
4. Scaffold does not activate packs. It never calls `qa-sdk ontology registry activate-pack <pack-id>` and never writes registry/index-meta activation state.

Candidate policy:

1. Known-pack registration is reported as a manual candidate for `packages/ontology-pack-validate/src/known-ontology-packs.ts`; scaffold must not mutate the resolver automatically.
2. Source-map output is a candidate-only frontmatter edit. It points generated implementation and test paths at the new definition docs, adds no source comments, and should be applied only after file writes are reviewed.
3. Candidate output should be concrete enough to support `def find-by-file` and `docs graph --axis source` verification after the operator applies the source-map frontmatter.

Authoring workflow:

1. Run `qa-sdk ontology pack scaffold <pack-id> --json` and review identity declarations, component-like schema declarations, system-like bindings, definition docs, source-map candidates, and known-pack registration candidates.
2. Re-run with `--write` only when the preview is acceptable.
3. Replace placeholder axis/taxonomy/relation/traversal vocabulary and blueprint refs with domain-specific content.
4. Run the generated tests and `qa-sdk ontology pack validate <pack-ref>`.
5. Apply source-map and known-pack candidates manually when review is complete.
6. Activate with `qa-sdk ontology registry activate-pack <pack-id>` only after scaffolded files and validation are complete.

Architecture policy:

1. Authoring preserves architecture-neutral separation of entity-like ids, component-like data, and system-like transforms.
2. Operational ontology can model ECS as a domain architecture, but it is not limited to ECS and scaffold output must not become ECS-specific unless the requested pack explicitly is an ECS pack.
3. Entity-like ids identify stable ontology terms. Component-like declarations stay data-only. System-like transforms live in validators, blueprints, projectors, allocation, activation, or docs graph logic.

Existing examples:

- `programming-artifact-ontology` is the operational ontology example for artifact vocabulary, registry provider binding, and activation evidence.
- `authorization-ontology` is the cross-package example for authorization vocabulary, permission-engine bridge evidence, and known-pack resolver registration.

registry 규칙:

1. pack registry는 pack 목록 조회와 id 기반 조회를 제공한다.
2. `validateAll()`은 pack id 중복과 각 pack 내부 검증 결과를 함께 반환한다.
3. registry는 pack 내용을 직접 수정하지 않고, pack validation 결과만 제공한다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/pack.test.ts`
