---
def:
  id: data-structure-profile-cli
  type: spec
  tier: interface
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: data-structure-profile
  tags: [cli, contract, fixture]
  links:
    - target: data-structure-profile-system
      type: refines
    - target: data-structure-profile-profile-contract
      type: depends_on
sources:
  - packages/data-structure-profile/package.json
  - packages/data-structure-profile/src/cli.ts
  - packages/data-structure-profile/src/cli-runner.ts
  - packages/data-structure-profile/src/cli-runner.test.ts
---

# Data Structure Profile CLI

## 목적 ^purpose

`data-structure-profile` CLI는 checked-in profile fixtures에서 validation, lineage, measurement, DPM readiness artifacts를 재생산하는 package-local fixture runner다.

## Commands ^defines

| Command | Output |
|---|---|
| `validate <profile.yaml>` | validation report |
| `validate <profile.yaml> --taxonomy <taxonomy.yaml>` | taxonomy-backed validation report |
| `validate <profile.yaml> --adapter quality-ledger` | quality-ledger run input array |
| `compile <profile.yaml>` | compiled lineage artifact |
| `measure <profile.yaml>` | measurement dry-run report |
| `measure <profile.yaml> --adapter bench` | bench-compatible report input |
| `dpm-readiness <profile.yaml>` | DPM readiness report |

## Exit Rules ^constraint

- Help exits `0`.
- Unknown command, missing profile path, unknown option, missing option value, parse failure, or artifact generation failure exits `1`.
- `validate` exits `1` when validation status is `fail`.
- `validate --fail-on-warning` exits `1` for any non-`pass` validation status.
- `dpm-readiness` exits `1` only when its diagnostics include an error.
- JSON artifacts are written to stdout; usage and runtime errors are written to stderr.

## 관련 소스

- `packages/data-structure-profile/package.json` — bin and `./cli` export wiring
- `packages/data-structure-profile/src/cli.ts` — executable entrypoint
- `packages/data-structure-profile/src/cli-runner.ts` — command parser, IO boundary, exit code policy
- `packages/data-structure-profile/src/cli-runner.test.ts` — CLI fixture runner contract tests
