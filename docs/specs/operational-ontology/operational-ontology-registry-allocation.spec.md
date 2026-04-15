---
def:
  id: operational-ontology-registry-allocation
  level: module
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, persistence]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-allocation-validation-contract
      type: contains
    - target: operational-ontology-registry-lifecycle
      type: contains
    - target: operational-ontology-registry-persistence-handoff
      type: contains
    - target: operational-ontology-index-meta-sync-handoff
      type: contains
    - target: operational-ontology-registry-activation-cli
      type: contains
    - target: operational-ontology-registry-activation-result
      type: contains
    - target: operational-ontology-registry-activation-evidence
      type: contains
    - target: operational-ontology-registry-activation-cli-scenario-matrix
      type: contains
    - target: operational-ontology-scoped-prefix-decision
      type: contains
    - target: operational-ontology-registry-allocation-plan
      type: traces_to
    - target: operational-ontology-registry-allocation-todo
      type: traces_to
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
  - packages/registry-service/src/stores/ontology-registry-store.ts
  - packages/registry-service/src/stores/ontology-registry-validation.ts
  - packages/registry-service/src/modules/ontology/ontology-registry.service.ts
  - packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
---

# Operational Ontology Registry Allocation - module overview

## 목적 ^purpose

operational ontology schema가 registry-service와 index-meta로 승격되는 문서 family의 module overview를 정의한다. 목표는 local allocation model, lifecycle, activation CLI, activation result, activation evidence, scenario proof, persistence handoff, index-meta sync handoff, validation contract, scoped-prefix decision을 하나의 registry allocation family 아래 stable coordinate로 묶는 것이다.

## 구성 ^overview

이 module은 현재 구현된 registry allocation family의 소유 경계다. 상세한 lifecycle, command, payload, evidence, scenario proof는 leaf 문서가 소유하고, 이 문서는 어떤 leaf가 어떤 concern을 닫는지만 조립한다.

- **Allocation validation contract** - `OperationalOntologySchema`를 namespace, axis, taxonomy, allocation, segment plan으로 투영하고 local invariant를 검증한다.
- **Registry lifecycle** - Phase 2A persistence schema부터 Phase 5 activation helper/smoke까지의 현재 상태와 owner boundary를 정리한다.
- **Persistence handoff** - registry-service가 저장하는 namespace/axis/taxonomy/allocation/segment row shape와 store conflict naming을 정의한다.
- **Index-meta sync handoff** - active allocation bundle을 prefix registry/schema version records로 materialize하는 Phase 4 sync contract를 정의한다.
- **Activation CLI** - `qa-sdk ontology registry activate-pack <pack-id>` command surface와 local runtime boundary를 정의한다.
- **Activation result** - helper result payload, no-rollback policy, and structured failure semantics를 정의한다.
- **Activation evidence** - `--output`, `--artifact-registry`, `activation-evidence`, append/upsert, provider consumption behavior를 정의한다.
- **Activation scenario matrix** - known-pack local CLI proof, evidence references, and remaining non-goal rows를 기록한다.
- **Scoped prefix decision** - scoped prefix 도입 전 global `(prefix, versionId)` uniqueness와 schema/API migration gate를 유지한다.

## Family Ownership ^defines

`operational-ontology-system`은 이 module을 포함한다. 이 module은 registry allocation 내부 leaf를 포함한다. 따라서 lifecycle, activation, evidence, and scenario leaf docs는 system group의 direct child가 아니라 이 module의 child로 유지한다.

Leaf ownership is intentionally narrow:

| leaf | owned concern |
|------|---------------|
| `operational-ontology-allocation-validation-contract` | local allocation projection and invariant validation |
| `operational-ontology-registry-lifecycle` | Phase 2A through Phase 5 current lifecycle state |
| `operational-ontology-registry-persistence-handoff` | persistence records, store conflict shape, no-partial-write contract |
| `operational-ontology-index-meta-sync-handoff` | active allocation sync input, product/sum materialization, sync reports |
| `operational-ontology-registry-activation-cli` | public command surface and local runtime boundary |
| `operational-ontology-registry-activation-result` | activation helper payload, no-rollback policy, structured failures |
| `operational-ontology-registry-activation-evidence` | sidecar output, registry append/upsert, provider consumption |
| `operational-ontology-registry-activation-cli-scenario-matrix` | concrete local scenario proof and test evidence |
| `operational-ontology-scoped-prefix-decision` | future scoped-prefix decision criteria |

## Current Boundary

The implemented allocation family covers local allocation, persistence, store adapter validation, service lifecycle, index-meta sync, helper activation, local CLI activation, explicit activation evidence persistence, and scenario proof for `programming-artifact-ontology` and `authorization-ontology`.

This module does not add registry-service REST activation, a remote activation service, scoped-prefix schema/API migration, dynamic external pack loading, or pack authoring commands. Those remain follow-up concerns owned by their own PRDs and must not be inferred from the local CLI lifecycle.

## Source Policy

Module sources stay conservative and point at the stable implementation boundaries that define allocation, store/service lifecycle, sync, and helper activation. PRD files are not frontmatter sources for this module; historical PRDs remain traces in task files or leaf narrative only, so docs status for this family is not widened by unrelated PRD documents.

Post-split CLI source boundaries are owned by the activation leaves:

| leaf | source boundary |
|------|-----------------|
| `operational-ontology-registry-activation-cli` | `packages/cli/src/commands/ontology/activation.ts` plus command descriptor, local runtime, helper, and CLI tests |
| `operational-ontology-registry-activation-result` | `packages/cli/src/commands/ontology/activation.ts` plus registry-service helper |
| `operational-ontology-registry-activation-evidence` | `packages/cli/src/commands/ontology/activation.ts`, `packages/cli/src/commands/ontology/artifact-registry.ts`, `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`, and the activation evidence registry helper |
| `operational-ontology-registry-activation-cli-scenario-matrix` | CLI and package tests that prove local activation scenarios |

## 검증 명령

- `pnpm --filter @qa-sdk/cli test -- ontology`
- `pnpm --filter @qa-sdk/cli test -- docs`
- `pnpm --filter @qa-sdk/cli test -- def`
- `pnpm --filter @qa-sdk/cli typecheck`
- `pnpm --filter @qa-sdk/cli build`
- `pnpm --filter operational-ontology test -- programming-artifacts`
- `pnpm --filter operational-ontology typecheck`
- `pnpm --filter authorization-ontology test`
- `pnpm --filter authorization-ontology typecheck`
- `pnpm --filter definition-catalog test`
- `pnpm --filter definition-catalog typecheck`
- `node packages/cli/dist/index.js def validate`
