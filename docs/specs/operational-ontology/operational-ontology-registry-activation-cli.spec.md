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

이 CLI surface는 public/local execution boundary다. registry-service REST endpoint, remote activation service, scoped prefix API, artifact registry persistence는 포함하지 않는다.

- **Command descriptor**: `packages/cli/src/command-groups/ontology.commands.ts`의 `ontology.registry.activate-pack`.
- **Handler proxy**: ontology command group이 `cliOntology(["registry.activate-pack", ...rest])`로 위임한다.
- **Known pack resolver**: `packages/cli/src/lib/known-ontology-packs.ts`가 production pack exports만 매핑한다.
- **Local runtime**: `@qa-sdk/registry-service/ontology-local-runtime`이 하나의 SQLite driver 위에 registry-service ontology rows와 index-meta rows를 함께 구성한다.
- **Activation helper**: `OntologyPackActivationHelper.activateOntologyPack()`이 lifecycle ordering과 smoke checks의 SSOT다.

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

## Runtime Boundary

The local runtime opens registry-service/index-meta SQL infrastructure over one SQLite driver. It applies index-meta base DDL plus registry-service migrations, then shares that driver across `SqlOntologyRegistryStore`, `SqlPrefixRegistry`, and `SqlIndexMetaStore`.

The CLI command must not:

- start a Nest HTTP server,
- call registry-service REST APIs,
- create a second persistence abstraction,
- reach into raw SQL from command code,
- append activation output to the programming artifact registry.

## JSON Contract

`--json` and `--output` materialize the activation helper payload without wrapping successful or helper-returned failed results.

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

Pre-helper CLI/runtime failures use a result-like failed payload with `allocationSummaries: []`, empty sync/smoke summaries, and a structured `errors[]` entry. Helper lifecycle failures keep the helper result shape and set `status: "failed"`.

## Failure Contract

Known CLI-origin failure codes include:

| code | condition |
|------|-----------|
| `unknown-ontology-pack` | `<pack-id>` is not in the known pack resolver |
| `invalid-flag` | command-specific flag validation rejects an unsupported flag |
| `missing-flag-value` | a flag that requires a value has none |
| `invalid-address-model` | `--address-model` is neither `product` nor `sum` |
| `activation-runtime-error` | runtime setup fails before the helper returns a structured result |
| `activation-output-write-error` | `--output` cannot write the JSON sidecar |

Non-JSON CLI-origin failures preserve the stable JSON error code as a `<code>: <message>` prefix. Runtime and storage errors are sanitized; raw SQLite/SQL statement details are not printed.

Helper lifecycle failures continue through the activation summary `errors` list. Duplicate activation currently returns a structured `duplicate-allocation` helper failure instead of a CLI-level idempotent success.

## Proven Scenarios

The CLI test suite proves command discovery and dispatch through `main(["ontology", "registry", "activate-pack", ...])`, not only the handler proxy.

- `programming-artifact-ontology` activates through an isolated SQLite store, returns `programming-artifact` and `programming-artifact-relation` allocation summaries, syncs every allocation, and returns passing smoke checks.
- Re-running `programming-artifact-ontology` against the same store returns a structured `duplicate-allocation` failed result without leaking raw SQL.
- `authorization-ontology` activates through an isolated SQLite store, returns all eight authorization taxonomy allocation summaries, syncs every allocation, returns passing smoke checks, and exposes known authorization axes in `syncReports[*].materializedRecords[*].axisId`.
- Unknown pack id, invalid address model, helper duplicate failure, runtime storage failure, JSON output, text output, and `--output` sidecar paths have CLI coverage.

## Follow-up Work

The activation CLI is not the artifact evidence system. Follow-up work remains:

- registry-service REST activation endpoint,
- remote activation service/deployment surface,
- activation result persistence into the programming artifact registry,
- scoped prefix support if `operational-ontology-scoped-prefix-decision` later approves it.

## 검증 명령

- `pnpm --filter @qa-sdk/cli test -- ontology`
- `pnpm --filter @qa-sdk/cli typecheck`
- `pnpm --filter registry-service test`
- `pnpm --filter registry-service typecheck`
- `pnpm --filter registry-service build`
- `pnpm --filter operational-ontology test -- allocation`
- `pnpm --filter authorization-ontology test`
- `node packages/cli/dist/index.js def validate`
