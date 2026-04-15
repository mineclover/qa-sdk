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
  - packages/cli/src/commands/ontology/activation.ts
  - packages/cli/src/commands/ontology.test.ts
  - packages/cli/src/lib/known-ontology-packs.ts
  - packages/registry-service/src/ontology-local-runtime.ts
  - packages/registry-service/src/modules/ontology/local-activation-runtime.ts
  - packages/registry-service/src/modules/ontology/ontology-activation.helper.ts
---

# Operational Ontology Registry Activation CLI

## 목적 ^purpose

완료된 ontology registry activation lifecycle을 local CLI에서 실행하는 command surface와 runtime boundary를 정의한다. 목표는 `OntologyPackActivationHelper` lifecycle을 재구현하지 않고 `qa-sdk ontology registry activate-pack`로 호출하는 public/local operator contract를 고정하는 것이다.

## 구성 ^overview

This leaf owns the command path, supported flags, known pack resolver, and local SQLite runtime boundary. Activation result payload semantics, activation evidence persistence, and scenario proof are separate leaves in the registry allocation module.

- **Command descriptor** - `packages/cli/src/command-groups/ontology.commands.ts` exposes `ontology.registry.activate-pack`.
- **Handler proxy** - the ontology command group routes to `cliOntology(["registry.activate-pack", ...rest])`.
- **Known pack resolver** - production package exports provide the finite pack id set.
- **Local runtime** - registry-service and index-meta SQL infrastructure are opened on one SQLite driver.
- **Activation helper port** - the CLI calls `OntologyPackActivationHelper.activateOntologyPack()` and prints or writes the returned payload.

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

Supported pack ids are intentionally finite:

| pack id | import contract |
|---------|-----------------|
| `programming-artifact-ontology` | `operational-ontology/programming-artifacts` exports `programmingArtifactOntologyPack` |
| `authorization-ontology` | `authorization-ontology` exports `authorizationOntologyPack` |

Flag behavior:

- `--store <path>` selects the local SQLite store. `:memory:` is supported.
- `--ontology-id`, `--namespace`, `--owner`, and `--version` pass metadata overrides into pack registration.
- `--address-model product|sum` selects the allocation model; other values fail before helper execution.
- `--prefix <taxonomyId>=<prefix>` is repeatable and provides deterministic taxonomy prefix overrides.
- `--json` prints the activation helper result on stdout.
- `--output <file>` writes the activation result payload as a pretty JSON sidecar.
- `--artifact-registry <file>` requests explicit activation evidence persistence and requires `--output <file>`.

Detailed result fields are owned by `operational-ontology-registry-activation-result`. Detailed evidence append/upsert and provider behavior are owned by `operational-ontology-registry-activation-evidence`.

## Runtime Boundary

The local runtime opens one SQLite driver per command invocation. It applies index-meta base DDL plus registry-service ontology migrations, then constructs:

- `SqlOntologyRegistryStore`
- `SqlPrefixRegistry`
- `SqlIndexMetaStore`
- `OntologyIndexMetaSyncAdapter`
- `OntologyRegistryService`
- `OntologyPackActivationHelper`

The CLI command must not start a Nest HTTP server, call registry-service REST APIs, create a second persistence abstraction, reach into raw SQL from command code, or infer remote activation semantics from the local SQLite workflow.

## Failure Ownership

The CLI owns argument parsing, known pack resolution, local runtime setup, output sidecar writing, and explicit evidence append orchestration. Helper lifecycle failures remain helper results and are not wrapped into a different CLI schema.

Known CLI-origin failure codes are documented in `operational-ontology-registry-activation-result`; evidence-specific failures are documented in `operational-ontology-registry-activation-evidence`.

## Scenario Proof

The local CLI scenario proof is not duplicated here. `operational-ontology-registry-activation-cli-scenario-matrix` records known pack activation, sidecar output, evidence append, registry consumption, rerun/upsert, duplicate/failure interpretation, and cross-pack coexistence evidence references.

## Non-Goals

This command does not define registry-service REST activation, remote activation service behavior, scoped prefix support, production store ownership, API idempotency, tenancy/auth policy, or compensating rollback semantics.

## Source Reference Boundary

Current frontmatter sources point at the extracted activation implementation module, command descriptor source, local runtime files, helper source, and CLI tests. `packages/cli/src/commands/ontology.ts` remains the public router, but it is no longer the implementation source for activation parsing, output handling, structured command failures, known pack imports, or explicit evidence append orchestration.

No `@def.doc` annotation is required because the file-level source map reaches the extracted activation command implementation.

## 검증 명령

- `pnpm --filter @qa-sdk/cli test -- ontology`
- `pnpm --filter @qa-sdk/cli typecheck`
- `pnpm --filter @qa-sdk/cli build`
- `node packages/cli/dist/index.js def validate`
