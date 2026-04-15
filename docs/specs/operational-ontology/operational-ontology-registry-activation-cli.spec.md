---
def:
  id: operational-ontology-registry-activation-cli
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: operational-ontology-registry-allocation
      type: depends_on
    - target: operational-ontology-pack-interface
      type: depends_on
sources:
  - packages/cli/src/command-groups/ontology.commands.ts
  - packages/cli/src/commands/ontology.ts
  - packages/cli/src/commands/ontology.test.ts
  - packages/cli/src/lib/known-ontology-packs.ts
  - packages/registry-service/src/ontology-local-runtime.ts
  - packages/registry-service/src/modules/ontology/local-activation-runtime.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
---

# Operational Ontology Registry Activation CLI

## 목적 ^purpose

완료된 ontology registry activation lifecycle을 로컬 CLI에서 실행하는 계약을 정의한다. 목표는 `OntologyPackActivationHelper`가 소유한 pack validation, reservation, allocation activation, index-meta sync, smoke summary를 재구현하지 않고 `qa-sdk ontology registry activate-pack` 명령으로 호출하게 만드는 것이다.

## 구성 ^overview

이 CLI surface는 public/local execution boundary다. 완료된 activation helper lifecycle을 실행하고, 명시적 `--artifact-registry`가 있을 때 성공한 activation result를 local programming artifact registry evidence로 append한다. registry-service REST endpoint, remote activation service, scoped prefix API는 포함하지 않는다.

- **Command descriptor**: `packages/cli/src/command-groups/ontology.commands.ts`의 `ontology.registry.activate-pack`.
- **Handler proxy**: ontology command group이 `cliOntology(["registry.activate-pack", ...rest])`로 위임한다.
- **Known pack resolver**: `packages/cli/src/lib/known-ontology-packs.ts`가 production pack exports만 매핑한다.
- **Local runtime**: `@qa-sdk/registry-service/ontology-local-runtime`이 하나의 SQLite driver 위에 registry-service ontology rows와 index-meta rows를 함께 구성한다.
- **Activation helper**: `OntologyPackActivationHelper.activateOntologyPack()`이 lifecycle ordering과 smoke checks의 SSOT다.
- **Activation evidence mapper**: `packages/cli/src/lib/activation-evidence-registry.ts`가 successful activation result와 resolved sidecar path를 `kind: "activation-evidence"` programming artifact registry record로 변환한다.

## Command Surface ^defines

```bash
qa-sdk ontology registry activate-pack <pack-id> \
  [--store <path>] \
  [--ontology-id <id>] \
  [--namespace <namespace>] \
  [--owner <owner>] \
  [--version <versionId>] \
  [--address-model product|sum] \
  [--prefix <taxonomyId>=<prefix>] \
  [--output <file>] \
  [--artifact-registry <file>] \
  [--json]
```

Supported pack ids are intentionally finite and resolved from production exports.

| pack id | import contract |
|---------|-----------------|
| `programming-artifact-ontology` | `operational-ontology/programming-artifacts` exports `programmingArtifactOntologyPack` |
| `authorization-ontology` | `authorization-ontology` exports `authorizationOntologyPack` |

Flag behavior:

- `--store <path>` selects the local SQLite store. `:memory:` is supported by the local runtime and persistent paths create parent directories through the runtime path setup.
- `--ontology-id`, `--namespace`, `--owner`, and `--version` pass metadata overrides into pack registration.
- `--address-model product|sum` selects the allocation model. Other values fail before helper execution with `invalid-address-model`.
- `--prefix <taxonomyId>=<prefix>` is repeatable and provides deterministic taxonomy prefix overrides.
- `--json` prints the unwrapped activation helper result on stdout.
- `--output <file>` writes the same pretty JSON payload that `--json` prints. Parent directories are created before writing. Text mode still prints the concise activation summary and includes the resolved output path.
- `--artifact-registry <file>` appends successful activation evidence to a local programming artifact registry. It requires `--output <file>` because the registry record must point at materialized sidecar evidence.

Activation evidence append behavior:

- `--output` alone remains sidecar-only JSON materialization and does not write a registry record.
- With `--output` and `--artifact-registry`, the CLI writes the activation sidecar first, then builds and upserts an `activation-evidence` registry record only when `result.status === "succeeded"`.
- Failed activation results and output-write failures do not append managed registry evidence.
- The sidecar file remains the raw activation helper result. Registry append metadata is reported only in command stdout.
- JSON stdout includes additive `activationEvidence` when append is attempted. Text stdout reports the registry path and record id on append success, and a sanitized append error on append failure.
- Append failure sets process exit code 1 and does not rewrite the activation sidecar.

## Runtime Boundary

The local runtime opens registry-service/index-meta SQL infrastructure over one SQLite driver. It applies index-meta base DDL plus registry-service migrations, then shares that driver across `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, and `SqlIndexMetaStore`.

The CLI command must not:

- start a Nest HTTP server,
- call registry-service REST APIs,
- create a second persistence abstraction,
- reach into raw SQL from command code,
- append activation output implicitly from `--output` alone,
- append failed activation results as managed programming artifact evidence.

## JSON Contract

`--output` always materializes the activation helper payload without wrapping successful or helper-returned failed results. `--json` prints that same payload, except successful `--artifact-registry` runs and sanitized append failures may add an `activationEvidence` object to stdout only.

Required stable summary fields:

- `status`
- `packId`
- `ontologyId`
- `namespaceSummary`
- `allocationSummaries`
- `syncSummariesByAllocationId`
- `smokeCheckSummary`
- `warnings`
- `errors`

Raw detail fields such as `namespaceRecord`, `allocations`, `activationStatuses`, `syncReports`, and `smokeChecks` may also be present for debugging and future API surfaces.

`activationEvidence` is additive stdout metadata and is intentionally absent from the sidecar file. Successful append shape:

```json
{
  "activationEvidence": {
    "appendStatus": "appended",
    "registryPath": "artifacts/programming-artifacts.json",
    "recordId": "activation-evidence-programming-artifact-ontology-programming-artifact-ontology",
    "recordRef": "artifacts/activation/programming-artifact-ontology.json",
    "recordCount": 1
  }
}
```

Sanitized append failure shape:

```json
{
  "activationEvidence": {
    "appendStatus": "failed",
    "registryPath": "artifacts/programming-artifacts.json",
    "recordId": "activation-evidence-programming-artifact-ontology-programming-artifact-ontology",
    "recordRef": "artifacts/activation/programming-artifact-ontology.json",
    "recordCount": null,
    "error": {
      "code": "activation-evidence-registry-append-error",
      "message": "Activation evidence could not be appended to the artifact registry."
    }
  }
}
```

Pre-helper CLI/runtime failures use a result-like failed payload with `allocationSummaries: []`, empty sync/smoke summaries, and a structured `errors[]` entry. Helper lifecycle failures keep the helper result shape and set `status: "failed"`.

## Failure Contract

Known CLI-origin failure codes include:

| code | condition |
|------|-----------|
| `unknown-ontology-pack` | `<pack-id>` is not in the known pack resolver |
| `invalid-cli-flag` | command-specific flag validation rejects an unsupported flag |
| `missing-flag-value` | a flag that requires a value has none |
| `invalid-address-model` | `--address-model` is neither `product` nor `sum` |
| `activation-runtime-error` | runtime setup fails before the helper returns a structured result |
| `activation-output-write-error` | `--output` cannot write the JSON sidecar |
| `activation-evidence-output-required` | `--artifact-registry` was provided without `--output` |
| `activation-evidence-registry-append-error` | successful activation wrote the sidecar but could not append the programming artifact registry record |

Non-JSON CLI-origin failures preserve the stable JSON error code as a `<code>: <message>` prefix. Runtime and storage errors are sanitized; raw SQLite/SQL statement details are not printed.

Helper lifecycle failures continue through the activation summary `errors` list. Duplicate activation currently returns a structured `duplicate-allocation` helper failure instead of a CLI-level idempotent success.

`activation-evidence-registry-append-error` is reported through additive `activationEvidence.appendStatus: "failed"` instead of mutating the helper result or sidecar. It is a command failure for automation purposes, but the activation result itself remains successful.

## Proven Scenarios

The CLI test suite proves command discovery and dispatch through `main(["ontology", "registry", "activate-pack", ...])`, not only the handler proxy.

- `programming-artifact-ontology` activates through an isolated SQLite store, returns `programming-artifact` and `programming-artifact-relation` allocation summaries, syncs every allocation, and returns passing smoke checks.
- Re-running `programming-artifact-ontology` against the same store returns a structured `duplicate-allocation` failed result without leaking raw SQL.
- `programming-artifact-ontology --output <file> --artifact-registry <registry> --json` writes the raw activation sidecar, appends exactly one `activation-evidence` record, validates the registry, lists the record by kind, and resolves the sidecar through `ontology prompt extract-artifact` as an `artifact-registry-hit`.
- Successful reruns with a fresh activation store and the same registry/output identity upsert the same activation evidence record instead of duplicating it.
- Duplicate/failed activation against the original store does not append or replace successful registry evidence with failed evidence.
- `authorization-ontology` activates through an isolated SQLite store, returns all eight authorization taxonomy allocation summaries, syncs every allocation, returns passing smoke checks, and exposes known authorization axes in `syncReports[*].materializedRecords[*].axisId`.
- `authorization-ontology --output <file> --artifact-registry <registry> --json` writes a raw sidecar, appends deterministic `activation-evidence-authorization-ontology-authorization-ontology` evidence with authorization namespace/allocation/sync/smoke/warning/error metadata, validates/lists the registry record, resolves the sidecar through `ontology prompt extract-artifact` as an `artifact-registry-hit`, upserts a successful rerun, and preserves the successful record after duplicate same-store failure.
- Unknown pack id, invalid address model, helper duplicate failure, runtime storage failure, JSON output, text output, and `--output` sidecar paths have CLI coverage.
- Missing `--output` with `--artifact-registry`, output write failure, sanitized registry append failure, and text-mode activation evidence reporting have CLI coverage.

## Programming Artifact Evidence Replay Sequence

The local replay proof for `programming-artifact-ontology` uses separate activation stores for sidecar-only, first evidence append, and successful rerun. Reusing the first evidence store is reserved for the duplicate/failed activation check.

```bash
WORKDIR="$(mktemp -d)"
SIDECAR_ONLY_STORE="$WORKDIR/sidecar-only.sqlite"
FIRST_STORE="$WORKDIR/first.sqlite"
RERUN_STORE="$WORKDIR/rerun.sqlite"
SIDECAR_ONLY_OUTPUT="$WORKDIR/activation/sidecar-only.json"
OUTPUT="$WORKDIR/activation/programming-artifact-ontology.json"
DUPLICATE_OUTPUT="$WORKDIR/activation/duplicate-failed.json"
REGISTRY="$WORKDIR/programming-artifacts.json"

qa-sdk ontology registry activate-pack programming-artifact-ontology \
  --store "$SIDECAR_ONLY_STORE" \
  --output "$SIDECAR_ONLY_OUTPUT" \
  --json

qa-sdk ontology registry activate-pack programming-artifact-ontology \
  --store "$FIRST_STORE" \
  --output "$OUTPUT" \
  --artifact-registry "$REGISTRY" \
  --json

qa-sdk ontology artifact registry validate \
  --input "$REGISTRY" \
  --json

qa-sdk ontology artifact registry list \
  --input "$REGISTRY" \
  --kind activation-evidence \
  --json

qa-sdk ontology prompt extract-artifact "$OUTPUT" \
  --artifact-registry "$REGISTRY" \
  --kind self_reflection \
  --json

qa-sdk ontology registry activate-pack programming-artifact-ontology \
  --store "$RERUN_STORE" \
  --output "$OUTPUT" \
  --artifact-registry "$REGISTRY" \
  --json

qa-sdk ontology artifact registry list \
  --input "$REGISTRY" \
  --kind activation-evidence \
  --json

qa-sdk ontology registry activate-pack programming-artifact-ontology \
  --store "$FIRST_STORE" \
  --output "$DUPLICATE_OUTPUT" \
  --artifact-registry "$REGISTRY" \
  --json

qa-sdk ontology artifact registry list \
  --input "$REGISTRY" \
  --kind activation-evidence \
  --json
```

Expected replay observations:

- The sidecar-only command writes `SIDECAR_ONLY_OUTPUT` without `activationEvidence` stdout/sidecar metadata and without creating or mutating a programming artifact registry.
- The first explicit registry command writes `OUTPUT` before appending evidence; the sidecar remains the raw activation helper result and stdout carries additive `activationEvidence`.
- `validate` returns a valid registry and `list --kind activation-evidence` returns exactly one record for the command.
- `extract-artifact "$OUTPUT" --artifact-registry "$REGISTRY" --json` reports `source.kind: "artifact-registry-hit"` through the `programming-artifact-registry` provider.
- The successful rerun with the same pack, ontology id, output path, and registry path upserts the deterministic `activation-evidence-<packId>-<ontologyId>` record; the filtered list still contains one record.
- The duplicate activation against `FIRST_STORE` exits with a structured `duplicate-allocation` failed result and does not replace the prior successful record with `DUPLICATE_OUTPUT` or failed metadata.

## Follow-up Work

Completed public/local follow-up:

- activation result persistence into the local programming artifact registry through `--artifact-registry`.

Follow-up work remains:

- registry-service REST activation endpoint,
- remote activation service/deployment surface,
- scoped prefix support if `operational-ontology-scoped-prefix-decision` later approves it.

## 검증 명령

- `pnpm --filter @qa-sdk/cli test -- ontology`
- `pnpm --filter @qa-sdk/cli typecheck`
- `pnpm --filter @qa-sdk/cli build`
- `pnpm --filter operational-ontology test -- programming-artifacts`
- `pnpm --filter operational-ontology typecheck`
- `pnpm --filter operational-ontology build`
- `pnpm --filter registry-service test -- ontology`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `pnpm --filter authorization-ontology test`
- `pnpm --filter authorization-ontology typecheck`
- `pnpm --filter authorization-ontology build`
- `node packages/cli/dist/index.js def validate`

Build validation runs dependency builds before dependent builds. In particular, do not run `operational-ontology build` concurrently with `registry-service build`; `registry-service` declaration generation consumes built operational ontology declarations.
