---
def:
  id: operational-ontology-registry-activation-cli-scenario-matrix
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: operational-ontology-registry-activation-cli
      type: refines
    - target: operational-ontology-pack-interface
      type: depends_on
    - target: programming-artifact-ontology-system
      type: depends_on
    - target: authorization-ontology-system
      type: depends_on
sources:
  - packages/cli/src/commands/ontology.test.ts
  - packages/cli/src/lib/activation-evidence-registry.ontology.test.ts
  - packages/operational-ontology/src/programming-artifacts.test.ts
  - packages/authorization-ontology/src/index.test.ts
---

# Operational Ontology Registry Activation CLI Scenario Matrix

## 목적 ^purpose

Document the local `qa-sdk ontology registry activate-pack` scenario matrix before REST activation design begins. The matrix records which known pack scenarios are already proven by concrete tests and which local CLI rows remain gaps owned by later stories in the CLI scenario hardening PRD.

## 구성 ^overview

This matrix belongs to the local activation CLI surface defined by `operational-ontology-registry-activation-cli`. It evaluates only local command behavior, local SQLite activation stores, explicit sidecar output, and explicit programming artifact registry evidence append.

This document does not define or imply registry-service REST activation, a remote activation service, scoped prefix support, production store ownership, API idempotency, or rollback/compensating rollback behavior.

Legend:

- `E-*` means the row is implemented and linked to a concrete test title below.
- `Gap: US-*` means the row is not yet covered and is assigned to that later story in `tasks/prd-ontology-registry-cli-scenario-hardening.md`.
- `N/A` means the column cannot apply to that row, usually because the row uses known pack ids and the scenario is the no-known-pack guardrail.

## Scenario Matrix

| row | activation success | sidecar-only output | activation evidence append | registry validate/list | artifact extraction registry hit | duplicate same-store failure | rerun/upsert same evidence identity | output write failure | registry append failure | unknown pack | invalid flag | invalid address model |
|-----|--------------------|---------------------|----------------------------|------------------------|----------------------------------|------------------------------|-------------------------------------|----------------------|-------------------------|--------------|--------------|-----------------------|
| `programming-artifact-ontology` | `E-PROG-ACTIVATE` | `E-PROG-SIDECAR` | `E-PROG-APPEND`, `E-PROG-E2E` | `E-PROG-E2E` | `E-PROG-E2E` | `E-PROG-ACTIVATE`, `E-PROG-E2E` | `E-PROG-E2E` | `E-PROG-OUTPUT-FAIL` | `E-PROG-APPEND-FAIL` | N/A; see `E-GUARD-UNKNOWN` | `E-GUARD-FLAG` | `E-GUARD-ADDRESS` |
| `authorization-ontology` | `E-AUTH-ACTIVATE` | Gap: US-004 | Gap: US-004 | Gap: US-004 | Gap: US-004 | Gap: US-004 | Gap: US-004 | Gap: US-006 | Gap: US-006 | N/A; see `E-GUARD-UNKNOWN` | `E-GUARD-FLAG` | `E-GUARD-ADDRESS` |
| CLI guardrail without a known pack row | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | `E-GUARD-UNKNOWN` | `E-GUARD-FLAG` | `E-GUARD-ADDRESS` |

## Evidence References

- `E-PROG-ACTIVATE`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack activates programming artifact ontology through the public command path`. Proves public command activation success, allocation/sync/smoke summaries, and same-store duplicate helper failure for `programming-artifact-ontology`.
- `E-PROG-SIDECAR`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack writes --output JSON matching --json stdout`. Proves `--output` sidecar-only behavior and absence of `activationEvidence` without `--artifact-registry`.
- `E-PROG-APPEND`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack appends activation evidence after writing the sidecar`. Proves sidecar-first append, deterministic activation-evidence id, stdout metadata, and raw sidecar preservation.
- `E-PROG-E2E`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activation evidence is consumable end to end and upserts successful reruns`. Proves registry validate/list, prompt artifact extraction `artifact-registry-hit`, successful rerun upsert with the same evidence identity, and no failed evidence replacement after duplicate same-store activation.
- `E-PROG-OUTPUT-FAIL`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack does not append evidence when output sidecar write fails`. Proves output write failure blocks evidence append.
- `E-PROG-APPEND-FAIL`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack reports sanitized artifact registry append failures`. Proves command failure on registry append failure while preserving the successful activation sidecar without raw filesystem/SQL leakage.
- `E-AUTH-ACTIVATE`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack activates authorization ontology through the public command path`. Proves public command activation success, all eight authorization taxonomy allocation summaries, sync/smoke success, and known authorization axis materialization.
- `E-GUARD-UNKNOWN`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack reports unknown pack failures through the public command path`. Proves structured `unknown-ontology-pack` failures for unsupported pack ids.
- `E-GUARD-FLAG`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack --json rejects invalid flags as structured JSON`. Proves structured `invalid-cli-flag` failures before helper execution.
- `E-GUARD-ADDRESS`: [`packages/cli/src/commands/ontology.test.ts`](../../../packages/cli/src/commands/ontology.test.ts) test title `registry activate-pack rejects invalid address models with structured failure output`. Proves structured `invalid-address-model` failures before helper execution.

## Gap Assignments

- US-004 owns the authorization evidence persistence row: sidecar output, activation evidence append, registry validate/list, artifact extraction hit, duplicate same-store protection, and same-identity rerun/upsert proof for `authorization-ontology`.
- US-006 owns the operator failure interpretation row for pack-independent output write and registry append failures beyond the current programming-artifact coverage.
- US-005 owns cross-pack coexistence in one local programming artifact registry. That scenario is intentionally not represented as success in either single-pack row until the later story proves distinct records can coexist.
