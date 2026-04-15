---
def:
  id: operational-ontology-validation-boundary
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
    - target: definition-management
      type: depends_on
    - target: operational-ontology-schema-validation
      type: depends_on
    - target: programming-artifact-ontology-context-simulation
      type: depends_on
    - target: registry-system
      type: depends_on
    - target: index-meta-system
      type: depends_on
sources:
  - packages/cli/src/commands/def.ts
  - packages/definition-catalog/src/validate.ts
  - packages/definition-catalog/src/validate-semantic.test.ts
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/registry-service/src/lib/registry-service.ts
  - packages/registry-service/src/db/schema.ts
  - packages/index-meta/src/prefix-registry.ts
  - packages/index-meta/src/schema-sync.ts
  - packages/index-meta/src/db/schema.ts
---

# Operational Ontology Validation Boundary — ontology design 변경 검증 범위

## 목적 ^purpose

ontology design을 바꾸기 전에 어떤 문서, 패키지, gate를 local validation으로 닫고, 어떤 범위는 registry-service/index-meta lifecycle 구현으로 넘기는지 정의한다. 목표는 definition-catalog 검증, operational-ontology allocation 검증, programming-artifact simulation 검증, registry-service/index-meta lifecycle 검증을 한 지도에서 분리해 agent가 불필요한 구현 범위로 확장하지 않게 하는 것이다.

## 구성 ^overview

검증 경계는 네 겹이다.

- **Definition-catalog validation** — 문서 frontmatter, `contains`/`depends_on` 링크, `sources` 코드 참조, purpose/overview marker가 definition graph에서 닫히는지 확인한다.
- **Operational-ontology allocation validation** — schema/pack/allocation 순수 함수가 registry-service DB 없이 namespace, taxonomy, prefix/version/address allocation plan을 만들고 검증하는지 확인한다.
- **Programming-artifact simulation validation** — artifact registry fixture, quality-status sidecar, prompt extraction context/dataflow가 CLI simulation으로 닫히는지 확인한다.
- **Registry-service/index-meta lifecycle validation** — ontology pack activation, registry persistence, active allocation sync, prefix decode lifecycle을 실제 service/store 구현으로 검증한다.

## Validation Boundary Map

| 경계 | 변경 신호 | 반드시 보는 문서 | 반드시 보는 코드/테스트 | local gate |
|------|-----------|------------------|--------------------------|------------|
| definition-catalog validation | ontology 문서, link, source mapping 변경 | `definition-management`, `operational-ontology-definition-graph-requirements`, 이 문서, 변경 대상 spec | `packages/cli/src/commands/def.ts`, `packages/definition-catalog/src/validate.ts`, `packages/definition-catalog/src/validate-semantic.test.ts` | `node packages/cli/dist/index.js def validate` |
| operational-ontology allocation validation | axis/taxonomy/pack/allocation 의미 변경 | `operational-ontology-schema-validation`, `operational-ontology-registry-allocation-plan` | `packages/operational-ontology/src/internal/ontology-allocation-core.ts`, `packages/operational-ontology/src/allocation.test.ts` | `pnpm --filter operational-ontology test`, `typecheck`, `build` |
| programming-artifact simulation validation | artifact kind/relation/provider/quality-status context 변경 | `programming-artifact-ontology-system`, `programming-artifact-ontology-context-simulation` | 해당 문서의 `sources`에 연결된 provider/CLI implementation 및 fixture tests | operational-ontology gates, CLI targeted test when CLI behavior changes |
| registry-service/index-meta lifecycle validation | persistence table, activation flow, prefix sync, decode lifecycle 변경 | `operational-ontology-registry-allocation-plan`, `registry-system`, `index-meta-system` | `packages/registry-service/src/lib/registry-service.ts`, `packages/registry-service/src/db/schema.ts`, `packages/index-meta/src/prefix-registry.ts`, `packages/index-meta/src/schema-sync.ts` | registry-service/index-meta tests only when those packages are changed |

## Local Validation Story Boundary

local validation stories stop at authored docs and `operational-ontology` package gates unless the story explicitly changes registry-service or index-meta code. registry-service/index-meta implementation is not required to validate local ontology design stories.

For local stories, completion means:

1. changed ontology docs have top-level `sources` pointing to applicable implementation/test files.
2. `def validate` accepts the definition graph and code reference map.
3. `operational-ontology` test, typecheck, and build pass.
4. registry-service/index-meta lifecycle work stays documented in the allocation plan/todo instead of being implemented opportunistically.

## Escalation Rule

Escalate from local validation to lifecycle validation only when the change edits registry-service/index-meta files, adds persistence tables, changes prefix/version activation semantics, or requires active allocation to be decoded by `index-meta`. Reading registry-service/index-meta docs to confirm the boundary is allowed; implementing those packages is a separate story.

## Source Convention

Every ontology validation doc that describes implemented behavior should carry top-level `sources`. Use implementation files for the owned behavior and test files for the expected gate. Do not use prose-only references as a substitute for source links when a concrete package file exists.

For ontology module/leaf/plan/todo/knowledge frontmatter, `contains`, split, and source-map rules, use `operational-ontology-definition-graph-requirements` as the local contract before editing implementation docs.
