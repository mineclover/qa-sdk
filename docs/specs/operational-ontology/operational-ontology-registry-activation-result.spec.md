---
def:
  id: operational-ontology-registry-activation-result
  level: leaf
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: operational-ontology-registry-allocation
      type: refines
    - target: operational-ontology-registry-lifecycle
      type: depends_on
    - target: operational-ontology-registry-activation-cli
      type: refines
sources:
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts
---

# Operational Ontology Registry Activation Result

## 목적 ^purpose

Ontology registry activation helper와 local CLI가 반환하는 activation result payload, no-rollback policy, structured failure semantics를 정의한다. 목표는 result shape와 operator failure interpretation을 command surface와 evidence persistence에서 분리해 안정적인 data contract로 유지하는 것이다.

## 구성 ^overview

Activation result는 `OntologyPackActivationHelper.activateOntologyPack()` payload가 SSOT다. CLI는 helper lifecycle failures를 재해석하지 않고, CLI-origin failures만 result-like failed payload로 만든다.

## Payload Shape ^defines

| field | purpose |
|-------|---------|
| `status` | `succeeded` when no activation errors were collected; otherwise `failed` |
| `packId`, `ontologyId` | activation identity |
| `namespaceRecord` | raw namespace record from registration |
| `allocations` | raw allocation records returned by registration |
| `activationStatuses` | per-allocation activation status evidence |
| `syncReports` | raw Phase 4 sync reports |
| `smokeChecks` | product/sum smoke check records derived from sync post-checks |
| `namespaceSummary` | public namespace summary |
| `allocationSummaries` | allocation records joined with activation/sync status |
| `syncSummariesByAllocationId` | per-allocation materialized/idempotent/repaired/collision/deferred/target counts |
| `smokeCheckSummary` | aggregate and per-allocation smoke check counts |
| `warnings`, `errors` | structured activation issues with phase and allocation context when available |

`--json` prints this payload. `--output <file>` writes this payload as a pretty JSON sidecar. Evidence append metadata is not part of the sidecar payload.

## No-Rollback Policy

The current local lifecycle has no compensating rollback.

- If registration fails, no activation or sync is attempted.
- If a later allocation fails after earlier allocations were activated or synced, earlier persisted states remain as recorded and later allocations are marked `skipped`.
- If sync fails after activation, the allocation remains active and the error is reported with `phase: "sync"`.
- Registry-service and index-meta writes are not rolled back across their boundary.

Future compensating rollback requires a separate PRD with explicit transaction semantics.

## Structured Failure Semantics

Operator interpretation is split by owner:

- **Helper lifecycle failures** preserve helper payload shape, `status: "failed"`, phase-level `errors[]`, warnings, summaries, and raw details.
- **CLI-origin failures** happen before helper execution or after helper success. Unknown pack ids, invalid flags, invalid address models, runtime setup failures, output write failures, missing output for registry append, and registry append failures are CLI-owned.
- **Unexpected infrastructure errors** are sanitized into structured issues. Raw SQLite/SQL statements are not exposed.

Known CLI-origin codes are `unknown-ontology-pack`, `invalid-cli-flag`, `missing-flag-value`, `invalid-address-model`, `activation-runtime-error`, `activation-output-write-error`, `activation-evidence-output-required`, and `activation-evidence-registry-append-error`.

Structured failed activation results are not activation evidence. Managed activation evidence records are appended only when the helper result has `status: "succeeded"`.

## Source Reference Boundary

`OntologyPackActivationHelper` remains the source of truth for lifecycle result payloads, so registry-service helper source and tests stay in frontmatter. CLI-origin failure shaping, output sidecar write failures, and JSON printing live in `packages/cli/src/commands/ontology/activation.ts`.
