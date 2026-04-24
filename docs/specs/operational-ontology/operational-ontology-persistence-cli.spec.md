---
def:
  id: operational-ontology-persistence-cli
  tier: component
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: operation
  svc: operational-ontology
  tags: [contract, testing, observability]
  links:
    - target: operational-ontology-interface-plane
      type: refines
    - target: operational-ontology-persistence
      type: depends_on
    - target: operational-ontology-observation-plane
      type: depends_on
sources:
  - packages/cli/src/commands/ontology/ingest.ts
  - packages/cli/src/commands/ontology/status.ts
  - packages/cli/src/commands/ontology/navigation-diff.ts
---

# Operational Ontology Persistence CLI

## 목적 ^purpose

persisted operational ontology snapshot을 local CLI로 ingest, inspect, diff하는 command surface를 정의한다. 목표는 snapshot ingest helper, snapshot status/query helper, corridor/checkpoint/route/traversal/junction navigation diff helper를 어떤 command path와 flag contract로 노출하는지 고정하고, activation/pack authoring 같은 다른 lifecycle을 이 boundary에 섞지 않는 것이다.

## 명령 표면 ^defines

Snapshot ingest commands:

```bash
qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]
qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]
qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]
```

Snapshot status/diff commands:

```bash
qa-sdk ontology status [--scope <scope> | --snapshot <id>] [--store <file>] [--json] [--table]
qa-sdk ontology snapshot show <snapshot-id> [--store <file>] [--json]
qa-sdk ontology snapshot diff <from-snapshot-id> <to-snapshot-id> [--store <file>] [--json]
qa-sdk ontology snapshot diff-latest --scope <scope> [--store <file>] [--json]
```

Navigation view/diff commands:

```bash
qa-sdk ontology corridor list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology corridor show <corridor-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology corridor show-latest <corridor-id> --scope <scope> [--store <file>] [--json]
qa-sdk ontology corridor diff <corridor-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]
qa-sdk ontology corridor diff-latest <corridor-id> --scope <scope> [--store <file>] [--json]
qa-sdk ontology checkpoint list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology checkpoint show <root-checkpoint-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology checkpoint diff <root-checkpoint-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]
qa-sdk ontology checkpoint diff-latest <root-checkpoint-id> --scope <scope> [--store <file>] [--json]
qa-sdk ontology route list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology route show <branch-node-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology route diff <branch-node-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]
qa-sdk ontology route diff-latest <branch-node-id> --scope <scope> [--store <file>] [--json]
qa-sdk ontology traversal list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology traversal show <traversal-key> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology traversal diff <traversal-key> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]
qa-sdk ontology traversal diff-latest <traversal-key> --scope <scope> [--store <file>] [--json]
qa-sdk ontology junction list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology junction show <junction-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]
qa-sdk ontology junction diff <junction-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]
qa-sdk ontology junction diff-latest <junction-id> --scope <scope> [--store <file>] [--json]
```

## 경계 ^overview

- `packages/cli/src/commands/ontology/ingest.ts`는 projector output ingest와 snapshot persistence entrypoint를 소유한다.
- `packages/cli/src/commands/ontology/status.ts`는 snapshot status, summary, latest diff, snapshot-level inspect surface를 소유한다.
- `packages/cli/src/commands/ontology/navigation-diff.ts`는 corridor/checkpoint/route/traversal/junction list/show/diff surface를 소유한다.
- persistence helper semantics 자체는 `operational-ontology-persistence`가 소유한다.
- corridor/checkpoint/junction/route/traversal meaning은 `operational-ontology-observation-plane`이 소유한다.
- pack activation, artifact registry, prompt extraction, scaffold/validate는 이 문서 범위 밖이다.

## CLI contract

- `--store <file>`는 local SQLite/in-memory persistence target을 고르는 explicit input이다.
- `--scope <scope>`와 `--snapshot <id>`는 mutually exclusive lookup boundary로 사용한다.
- `--json`은 persisted helper output 또는 query/diff result를 구조화된 shape로 그대로 노출한다.
- `--table`은 `qa-sdk ontology status`에서만 compact summary projection을 추가로 제공한다.
- ingest command는 explicit `--input <file>` 없이는 실행되지 않는다.
- latest diff command는 explicit `--scope <scope>` 없이는 실행되지 않는다.
- 이 surface는 local persistence/query helper를 감싼다. Nest HTTP server, remote service orchestration, activation lifecycle, pack registry mutation을 시작하지 않는다.

## Source Reference Boundary

Current source map intentionally points only at the split persistence CLI modules. `packages/cli/src/commands/ontology.ts`와 `packages/cli/src/command-groups/ontology.commands.ts`는 stable router/descriptor surface지만, ingest/status/navigation implementation ownership은 이 leaf가 소유한다.

## 검증 명령

- `node packages/cli/dist/index.js docs graph packages/cli/src/commands/ontology/ingest.ts --axis source --json`
- `node packages/cli/dist/index.js docs graph packages/cli/src/commands/ontology/status.ts --axis source --json`
- `node packages/cli/dist/index.js docs graph packages/cli/src/commands/ontology/navigation-diff.ts --axis source --json`
- `node packages/cli/dist/index.js def validate`
