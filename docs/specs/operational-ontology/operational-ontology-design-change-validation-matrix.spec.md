---
def:
  id: operational-ontology-design-change-validation-matrix
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, cross-scope]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-validation-boundary
      type: depends_on
    - target: operational-ontology-definition-graph-requirements
      type: depends_on
    - target: operational-ontology-taxonomy-schema
      type: depends_on
    - target: operational-ontology-relation-category-schema
      type: depends_on
    - target: operational-ontology-allocation-validation-contract
      type: depends_on
    - target: operational-ontology-pack-interface
      type: depends_on
    - target: operational-ontology-registry-allocation-plan
      type: depends_on
    - target: definition-management
      type: depends_on
    - target: df-constraint
      type: depends_on
    - target: registry-system
      type: depends_on
    - target: index-meta-system
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/schema-core.ts
  - packages/operational-ontology/src/internal/runtime-core.ts
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/internal/pack-core.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/operational-ontology/src/pack.test.ts
  - packages/operational-ontology/src/persistence.test.ts
  - packages/cli/src/commands/def.ts
  - packages/definition-catalog/src/validate.ts
  - packages/registry-service/src/lib/registry-service.ts
  - packages/index-meta/src/schema-sync.ts
---

# Operational Ontology Design Change Validation Matrix — ontology 변경 시나리오별 검증 경로

## 목적 ^purpose

ontology design 변경 종류마다 필요한 문서, 코드 소유 경계, 테스트, 명령을 하나의 matrix로 고정한다. 목표는 axis, taxonomy, relation/category, allocation policy, definition graph, pack activation 변경이 서로 다른 validation path를 갖는다는 점을 명시하고, local validation과 registry-service/index-meta activation을 섞지 않게 하는 것이다.

## 구성 ^overview

이 matrix는 local validation story에서 항상 실행하는 gate와, 실제 활성화 구현을 건드릴 때만 추가되는 lifecycle gate를 분리한다.

- **Local validation** — definition graph와 `operational-ontology` 순수 함수/pack 검증으로 닫히는 범위.
- **Core gate analysis** — `axis-definition`, `prefix-design`, `merge-split`처럼 후속 좌표계를 바꾸는 결정에 필요한 impact analysis 또는 escalation 범위.
- **Activation validation** — registry-service persistence, active allocation, index-meta sync/decode가 바뀔 때만 실행하는 별도 범위.

여기서 code owner는 GitHub CODEOWNERS가 아니라 현재 repo에서 변경 책임을 갖는 package/file boundary를 뜻한다.

## Scenario Matrix

| 변경 종류 | required docs | code owners | local tests | local commands | registry-service/index-meta activation boundary |
|-----------|---------------|-------------|-------------|----------------|-----------------------------------------------|
| axis changes | `operational-ontology-taxonomy-schema`, `operational-ontology-schema-validation`, `operational-ontology-validation-boundary`, 이 matrix. 새 axis는 `docs/skills/prefix-add.md`의 5Q checklist(Q1 유한, Q2 의사결정, Q3 공유, Q4 안정, Q5 capacity)를 decision evidence로 남긴다. | `packages/operational-ontology/src/internal/schema-core.ts`; capacity/address 영향이 있으면 `packages/operational-ontology/src/internal/ontology-allocation-core.ts`. | schema registry coverage in `packages/operational-ontology/src/persistence.test.ts`; allocation impact in `packages/operational-ontology/src/allocation.test.ts`; pack impact in `packages/operational-ontology/src/pack.test.ts`. | `pnpm --filter operational-ontology test`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `node packages/cli/dist/index.js def validate`. | Do not activate locally. If axis changes require active prefix capacity or decode changes, add/execute registry-service and index-meta activation work in a separate story. |
| taxonomy changes | `operational-ontology-taxonomy-schema`, `operational-ontology-schema-validation`, `operational-ontology-allocation-validation-contract`, `operational-ontology-registry-allocation-plan`. | `schema-core.ts` for taxonomy integrity; `ontology-allocation-core.ts` for taxonomy-to-prefix/address projection. | `allocation.test.ts` for missing axis, duplicate prefix/version, product/sum allocation; `pack.test.ts` for pack schema composition. | `pnpm --filter operational-ontology test`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `node packages/cli/dist/index.js def validate`. | Activation begins only when taxonomy allocation rows, namespace state, or active prefix sync are persisted through registry-service/index-meta. |
| relation/category changes | `operational-ontology-relation-category-schema`, `operational-ontology-relation-taxonomy`, `operational-ontology-category-constraint`, `operational-ontology-schema-validation`. | `schema-core.ts` for category grammar; `runtime-core.ts` and projector core files only when relation category resolution changes runtime projection. | `pack.test.ts` for schema composition; affected projector tests when relation semantics alter event/pipe/path/snapshot projections. | `pnpm --filter operational-ontology test`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `node packages/cli/dist/index.js def validate`; add targeted projector test command when runtime semantics change. | Relation grammar activation is not an index-meta prefix activation unless it changes allocated taxonomy identity or persisted pack lifecycle. |
| allocation policy changes | `operational-ontology-allocation-validation-contract`, `operational-ontology-registry-allocation-plan`, `operational-ontology-registry-allocation-todo`, `operational-ontology-validation-boundary`. | `ontology-allocation-core.ts`; public facade `packages/operational-ontology/src/allocation.ts`. | `allocation.test.ts` is the executable SSOT for product allocation, sum segments, duplicate prefix/version, and missing taxonomy axis. | `pnpm --filter operational-ontology test -- allocation`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `node packages/cli/dist/index.js def validate`. | If persistence tables, lifecycle transitions, active allocation sync, or decode materialization change, also run registry-service/index-meta gates in the activation story. |
| definition graph changes | `definition-management`, `operational-ontology-definition-graph-requirements`, changed definition docs, `operational-ontology-validation-boundary`, this matrix. | `packages/definition-catalog/src/validate.ts`; CLI surface `packages/cli/src/commands/def.ts`. | Definition graph validation through CLI; definition-catalog unit tests only when validator code changes. | `node packages/cli/dist/index.js def validate`; run operational-ontology package gates too when changed docs govern this package. | Definition graph edits do not activate registry-service/index-meta. Boundary-crossing links require documented import/export or escalation before changing service lifecycle docs. |
| pack activation changes | `operational-ontology-pack-interface`, `operational-ontology-registry-allocation-plan`, `operational-ontology-registry-allocation-todo`, `registry-system`, `index-meta-system`. | Local pack boundary: `pack-core.ts`. Activation boundary: `packages/registry-service/src/lib/registry-service.ts`, registry DB schema/store files, `packages/index-meta/src/prefix-registry.ts`, `packages/index-meta/src/schema-sync.ts`. | Local: `pack.test.ts` and `allocation.test.ts`. Activation: registry-service activation tests and index-meta sync/version lifecycle tests. | Local: `pnpm --filter operational-ontology test`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `node packages/cli/dist/index.js def validate`. Activation story: `pnpm --filter @qa-sdk/registry-service test`; `pnpm --filter index-meta test`; matching typecheck/build for touched packages. | Pack activation is explicitly outside local validation unless registry-service/index-meta files are edited. Invalid pack no-write, activation audit, active prefix sync, and smoke decode are lifecycle requirements. |

## Core Gate Rule

Core gate changes are not silent local edits. Treat changes to `axis-definition`, `prefix-design`, and `merge-split` as decision-flow core gates because they can invalidate downstream address spaces.

Required path:

1. Run impact analysis when the governing flow schema is available: `qa-sdk flow analyze <schema-id> --impact <gate-id>`.
2. If the schema id is not available locally, or the change would set `invalidatesCore: true`, create an escalation request in the relevant decision context before editing the local ontology docs/code.
3. For new axes, attach the 5Q checklist result and computed capacity evidence before adding the axis to the ontology schema.

## Local Versus Activation Gates

Local validation is complete when the definition graph, `operational-ontology` tests, typecheck, and build pass. It proves the design and pure package contracts are internally consistent.

Registry-service/index-meta activation is complete only after persistence, lifecycle, active sync, and decode behavior are implemented and tested in those packages. Reading registry-service/index-meta docs is local validation; changing their code or database schema starts activation validation.
