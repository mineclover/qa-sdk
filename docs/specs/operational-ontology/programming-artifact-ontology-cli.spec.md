---
def:
  id: programming-artifact-ontology-cli
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [contract, testing, observability]
  links:
    - target: programming-artifact-ontology-system
      type: refines
    - target: programming-artifact-ontology-registry-provider
      type: depends_on
    - target: programming-artifact-ontology-activation-evidence
      type: depends_on
    - target: programming-artifact-ontology-quality-evidence
      type: depends_on
sources:
  - packages/cli/src/commands/ontology/artifact-registry.ts
  - packages/cli/src/commands/ontology/prompt-extract-artifact.ts
  - packages/cli/src/commands/ontology/quality-status-evidence.ts
  - packages/cli/src/commands/ontology/quality-ledger-evidence.ts
  - packages/cli/src/commands/ontology.ts
  - packages/cli/src/command-groups/ontology.commands.ts
---

# Programming Artifact Ontology CLI — artifact command contract

## 목적 ^purpose

`programming-artifact-ontology`가 제공하는 artifact registry 기능의 public CLI command, flag, JSON output contract를 정의한다. 목표는 command path와 flag behavior를 안정화하고, provider lookup, activation evidence, quality evidence의 구현 세부는 전용 leaf 문서로 위임하는 것이다.

## Commands ^defines

Artifact prompt extraction command:

```bash
qa-sdk ontology prompt extract-artifact <artifact-ref> \
  [--artifact-type <type>] \
  [--artifact-registry <file>] \
  [--artifact-registry-file <file>] \
  [--quality-ledger <path>] \
  [--quality-status-max-age-days <n>] \
  [--kind self_reflection|code_editing_rules|all] \
  [--use-case <usecase>] \
  [--persist-governance] \
  [--store <file>] \
  [--output <file|dir>] \
  [--json] \
  [--local|--server|--scan] \
  [--db <path>]
```

Artifact registry management commands:

```bash
qa-sdk ontology artifact registry validate --input <file> [--json]
qa-sdk ontology artifact registry list --input <file> [--kind <kind>] [--json]
qa-sdk ontology artifact registry append --output <file> \
  (--input <record.json> | --kind <kind> --artifact-ref <ref>) \
  [--produced-by <command>] \
  [--derived-from <csv>] \
  [--verifies <csv>] \
  [--owner-definition <id>] \
  [--materializes-output <csv>] \
  [--output-path <path>] \
  [--source-ref <csv>|--source-refs <csv>] \
  [--verification-ref <csv>|--verification-refs <csv>] \
  [--metadata <json-object>] \
  [--json]
```

Activation evidence producer command:

```bash
qa-sdk ontology registry activate-pack <pack-id> \
  [--store <path>] \
  [--output <file>] \
  [--artifact-registry <file>] \
  [--json]
```

## Flag Contract

- `--artifact-registry` is the primary local registry file flag for `extract-artifact`, prompt artifact materialization, codegen, quality export, deployment output, activation evidence append, and registry append workflows.
- `--artifact-registry-file` is accepted by `extract-artifact` as a compatibility alias for the read path.
- `--quality-ledger <path>` is accepted only by `extract-artifact`; it is an explicit SQLite quality ledger input for related quality evidence and never triggers automatic `.qa-sdk/quality-ledger.sqlite` discovery.
- `--quality-status-max-age-days <n>` is accepted only by `extract-artifact`; `<n>` must be a positive integer and applies an opt-in freshness SLA to related quality evidence.
- `--json` on `extract-artifact` includes `source.kind`, `source.registry`, fallback details, `source.qualityStatusRecords`, `source.governanceClosure`, and `source.qualitySignal`.
- `--json` on registry `validate` returns `{ input, valid, artifactCount, errors, warnings }`.
- `--json` on registry `list` returns `{ input, kind, artifacts }`.
- `--json` on registry `append` returns append metadata including `record`, `registryPath`, and `recordCount`.
- `append --input <record.json>` preserves the supplied record shape and upserts it by artifact identity.
- `append --kind ... --artifact-ref ...` creates a record through the shared programming artifact registry factory and normalizes relation fields into `relations[]`.
- registry `validate`, `list --kind`, and `append --kind` share `PROGRAMMING_ARTIFACT_KINDS`: `build`, `generated-source`, `quality-status`, `deployment-output`, `prompt-artifact`, `activation-evidence`.
- `activate-pack --artifact-registry <file>` requires `--output <file>`, writes managed activation evidence only for successful activation results, and reports append metadata under stdout JSON `activationEvidence`.
- `activate-pack --output <file>` without `--artifact-registry` remains sidecar-only.

Provider lookup semantics are owned by `programming-artifact-ontology-registry-provider`. Activation evidence mapping/consumption is owned by `programming-artifact-ontology-activation-evidence`. Quality-status snapshot, ledger fallback, freshness, and governance closure behavior are owned by `programming-artifact-ontology-quality-evidence`.

## Extract Artifact Order

The CLI-visible order for `extract-artifact` is stable:

1. read `--artifact-registry` or `--artifact-registry-file` when present.
2. try provider lookup for `<artifact-ref>`.
3. emit `artifact-registry-hit` if provider lookup succeeds.
4. attach matching quality evidence summaries when registry records support it.
5. on provider miss, fall back to file path, definition id, then search.
6. emit structured source JSON for hit, miss, file fallback, definition fallback, or search fallback.

## Registry JSON Contract

Registry files accept either an array of records or an object envelope `{ "artifacts": [...] }`. Activation evidence records use the same shape; their field semantics are documented in `programming-artifact-ontology-activation-evidence`.

## Fallback Source Contract

`extract-artifact --json` reports registry/fallback origin in `source`.

- `artifact-registry-hit` — registry provider generated context.
- `artifact-registry-miss` — registry file was present but the ref was not found.
- `artifact-file-fallback` — artifact ref delegated to file extraction.
- `artifact-definition-fallback` — artifact ref delegated to definition extraction.
- `artifact-search-fallback` — free string search generated synthetic context.

`artifact-search-fallback` does not block prompt extraction, but it must carry a degraded quality signal and `create_programming_artifact_registry_record` management action. `qualityStatusRecords.total` is the matched quality-status record count; all source kinds expose `{ total, records, warnings }`.

Detailed `records[].qualityExportSnapshot`, `records[].gateDescriptors`, `records[].qualityLedgerEvidence`, freshness warnings, and `source.governanceClosure` semantics are specified by `programming-artifact-ontology-quality-evidence`.

## Registry Write Path

Current public write paths are codegen, quality export, infra deploy output, prompt artifact materialization, activation evidence append, and explicit build registration through `ontology artifact registry append --kind build`. Each path fills the shared relation grammar with command provenance, derived inputs, verification refs, owner definition, and materialized output refs.

## Registry Command Behavior

`validate` reads array or `{ "artifacts": [...] }` envelope and separates missing field, invalid kind, and invalid relation diagnostics into errors/warnings. `list` applies optional `--kind`. `append` creates a new object envelope when the registry file is missing, preserves extra fields in existing object envelopes, upserts by artifact identity, and normalizes an existing array registry into an object envelope on write. `--artifact-registry` is accepted as an output alias for `append`.

These commands manage local JSON only. They do not start registry-service/index-meta allocation lifecycle.

## Source Reference Boundary

Current implementation sources are `packages/cli/src/commands/ontology/artifact-registry.ts`, `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`, `packages/cli/src/commands/ontology/quality-status-evidence.ts`, `packages/cli/src/commands/ontology/quality-ledger-evidence.ts`, `packages/cli/src/commands/ontology.ts`, and `packages/cli/src/command-groups/ontology.commands.ts`. The command group source stays stable because it owns public command descriptors. The monolithic ontology command source remains the static router and dependency handoff point for split command modules.

Source boundaries:

| command concern | source boundary |
|-----------------|------------------------|
| `ontology artifact registry validate/list/append` | `packages/cli/src/commands/ontology/artifact-registry.ts` |
| `ontology prompt extract-artifact` source resolution and fallback JSON | `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` |
| related quality-status snapshot/matching | `packages/cli/src/commands/ontology/quality-status-evidence.ts` |
| quality-ledger fallback, freshness, governance closure | `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` |
| `ontology registry activate-pack` production of activation evidence | `packages/cli/src/commands/ontology/activation.ts` |

Existing split modules appear in frontmatter; `packages/cli/src/commands/ontology.ts` stays there only for stable router dispatch.
