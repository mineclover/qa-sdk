---
def:
  id: operational-ontology-registry-allocation
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, persistence]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-allocation-validation-contract
      type: depends_on
    - target: operational-ontology-validation-boundary
      type: depends_on
    - target: operational-ontology-design-change-validation-matrix
      type: depends_on
    - target: operational-ontology-definition-graph-requirements
      type: depends_on
    - target: operational-ontology-registry-persistence-handoff
      type: depends_on
    - target: operational-ontology-index-meta-sync-handoff
      type: depends_on
    - target: operational-ontology-scoped-prefix-decision
      type: constrains
    - target: operational-ontology-registry-allocation-plan
      type: traces_to
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/registry-service/package.json
---

# Operational Ontology Registry Allocation — 현재 구현 및 검증 계약

## 목적 ^purpose

operational ontology schema를 registry-service와 index-meta가 나중에 소비할 수 있는 allocation contract로 고정한다. 목표는 현재 구현된 DB 독립 allocation model과 ralph로 닫은 validation/handoff 문서를 plan/todo가 아니라 현재 spec 표면으로 승격해, 후속 persistence/index-meta 구현이 안정된 local contract를 입력으로 삼게 만드는 것이다.

## 구성 ^overview

현재 완료된 범위는 local allocation contract와 handoff 문서화다.

- **Local allocation model** — `OperationalOntologySchema`를 namespace, axis registration, taxonomy registration, address allocation, segment record로 투영한다.
- **Local validation** — 단일 allocation plan 안의 duplicate key, missing axis, invalid size/offset, segment drift를 structured issue로 판정한다.
- **Design validation boundary** — ontology design 변경 시 definition graph, operational-ontology allocation, programming-artifact simulation, registry-service/index-meta lifecycle gate를 분리한다.
- **Handoff contracts** — registry-service persistence와 index-meta sync가 소비할 record shape, collision rule, activation smoke 기준을 문서화한다.
- **Prefix policy gate** — scoped prefix 도입 전까지 global `(prefix, versionId)` uniqueness와 현재 registry/index-meta/decode key shape를 유지한다.

## 현재 구현 ^defines

현재 코드 SSOT는 `packages/operational-ontology/src/internal/ontology-allocation-core.ts`다. 공개 표면은 `packages/operational-ontology/src/allocation.ts`와 `packages/operational-ontology/src/schema.ts`에서 export된다.

구현된 타입은 namespace, axis/taxonomy registration, address allocation, segment, policy, issue target, validation result, allocation plan이다. 구현된 함수는 `allocateOntologyAddressSpace(schema, policy)`와 `validateOntologyAddressAllocationPlan(plan)`이다.

## Projection Contract

`allocateOntologyAddressSpace()`는 DB 없이 하나의 allocation plan을 만든다.

- 기본 `versionId`는 `v1`이다.
- 기본 lifecycle은 `draft`, allocation status는 `reserved`다.
- 기본 address model은 `product`다.
- namespace는 policy namespace 또는 ontology id를 normalized identifier로 변환한다.
- axis capacity는 policy override, schema capacity, `nextPowerOf2(values.length * 2)` 순서로 결정한다.
- taxonomy마다 allocation 하나를 만든다.
- product allocation은 axis capacity product와 단일 product segment를 만든다.
- sum allocation은 axis capacity sum과 axis별 segment를 만든다.
- allocation id는 `${ontologyId}:${taxonomyId}:${versionId}`다.
- prefix는 policy override가 없으면 `${namespace}_${normalizedTaxonomyId}`다.

## Validation Contract

`validateOntologyAddressAllocationPlan()`은 local plan 내부 불변조건만 판정한다.

error는 빈 ontology id/namespace, 중복 axis/taxonomy registration, 중복 prefix/version allocation, 중복 taxonomy allocation, taxonomy axis registration 누락, identity axis mismatch, allocation size/offset 오류, segment allocation/size/consumes 오류를 포함한다.

warning은 allocation `capacity`와 `addressSize` drift를 포함한다.

issue는 `path`, `code`, `message`와 함께 가능하면 `target`을 가진다. `target`은 prefix, version, taxonomy, axis, allocation, segment id를 담아 후속 registry-service/store validation이 같은 대상을 구조적으로 보고하게 만든다.

## 검증된 시나리오

현재 `packages/operational-ontology/src/allocation.test.ts`가 아래 시나리오를 검증한다.

- product allocation.
- sum segment allocation.
- duplicate prefix/version allocation.
- missing taxonomy axis.
- structured local allocation drift errors with issue targets.

## 완료된 Handoff Specs

ralph stabilization 작업으로 아래 plan/todo 항목은 spec 문서로 반영됐다.

- `operational-ontology-validation-boundary` — ontology design 변경의 local/lifecycle validation boundary.
- `operational-ontology-design-change-validation-matrix` — 변경 종류별 required docs, owner boundary, tests, commands.
- `operational-ontology-definition-graph-requirements` — ontology module/leaf/plan/todo/knowledge 문서 graph 규칙.
- `operational-ontology-allocation-validation-contract` — local allocation projection/validation 불변조건.
- `operational-ontology-registry-persistence-handoff` — registry-service persistence record mapping과 future tests.
- `operational-ontology-index-meta-sync-handoff` — active allocation의 index-meta sync input과 smoke checks.
- `operational-ontology-scoped-prefix-decision` — scoped prefix schema freeze와 decision criteria.

## 구현 경계

아직 구현하지 않은 범위:

- registry-service ontology persistence tables.
- `OntologyRegistryStore`와 SQL/in-memory adapters.
- `OntologyRegistryService`.
- active allocation to index-meta sync.
- pack activation helper and smoke decode.
- scoped prefix schema/API migration.

이 범위는 `operational-ontology-registry-allocation.todo.md`의 Phase 2A 이후에 남긴다. local validation story는 registry-service/index-meta 코드를 요구하지 않는다.

## 검증 명령

현재 spec 반영 작업에서 통과해야 하는 기본 gate:

- `pnpm --filter operational-ontology test -- allocation`
- `pnpm --filter operational-ontology typecheck`
- `pnpm --filter operational-ontology build`
- `node packages/cli/dist/index.js def validate`

registry-service phase 문서는 `pnpm --filter registry-service typecheck`를 사용할 수 있다. 이 명령은 `packages/registry-service/package.json`의 `typecheck` script가 SSOT다.
