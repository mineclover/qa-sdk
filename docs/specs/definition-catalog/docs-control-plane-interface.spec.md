---
def:
  id: docs-control-plane-interface
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [contract, testing]
  links:
    - target: docs-control-plane
      type: refines
    - target: cli-command-spec
      type: depends_on
sources:
  - packages/cli/src/command-groups/docs.commands.ts
  - packages/cli/src/commands/docs.ts
---

# Docs Control Plane Interface

## 목적 ^purpose

`qa-sdk docs` CLI의 command descriptor, dispatch, command-specific text/JSON surface를 정의한다. 이 문서는 docs-control-plane system 내부의 Interface/DSL 책임을 소유하고, graph traversal semantics와 BDD behavior는 별도 child spec이 소유한다.

## 명령 표면 ^defines

| command family | 역할 | 구현 |
|----------------|------|------|
| `docs help` | quick start와 usage 출력 | `cliDocs`, `DOCS_COMMAND_DESCRIPTORS` |
| `docs status` | target/family status, role coverage, follow-up summary | `cmdStatus`, `buildStatusResult` |
| `docs explore` | root-index routed guided entrypoint (`intent|map|diagnostic`) | `cmdExplore`, `buildExploreResult` |
| `docs collect` | scoped document/source/task/evidence inventory | `cmdCollect`, `buildCollectResult` |
| `docs graph` | graph traversal view entrypoint | `cmdGraph`, delegated graph modules |
| `docs search` | text search 또는 selector-bounded root-index search | `cmdSearch` |
| `docs drift` | PRD/session/document drift read model | `cmdDrift` |
| `docs bdd ...` | BDD read-only command family | delegated to `docs-control-plane-bdd` |
| `docs prd ...` | PRD context/scaffold/ralph-json/sync-completion | `cmdPrd*` |
| `docs transform metadata` | dry-run-first metadata transform preview | `cmdTransformMetadata` |

## Command assembly rules

- `packages/cli/src/commands/docs.ts` owns argument parsing, dispatch, text/JSON rendering, and exit code policy.
- `packages/cli/src/command-groups/docs.commands.ts` owns command descriptors, help usage, and CLI tree metadata.
- Reusable read-model construction belongs under `packages/cli/src/lib/docs-control-plane/**`.
- New write surfaces must be explicit, dry-run-first unless the command is intentionally materializing an output file.

## Selector routing

`docs explore`와 `docs search`는 text/path lookup 외에 selector 기반 root-index routing을 지원한다.

| selector | routed root |
|----------|-------------|
| `doc:<stableId>` | 해당 문서 |
| `service:<svc>` | `svc`가 일치하는 문서 중 entry-point/overview/layout-system 우선 root |
| `owner:<owner_system>` | `owner_system`이 일치하는 문서 중 root index |
| `family:<familyId>` | family 내부 root index |

짧은 alias:

- `svc:<svc>` → `service:<svc>`
- `own:<owner_system>` → `owner:<owner_system>`
- `fam:<familyId>` → `family:<familyId>`

기본 철학:

- selector는 broad search가 아니라 root-index routing이다.
- root index는 `entry-point`, `overview`, `tier: layout|system`을 우선한다.
- `docs explore` 기본 모드는 `intent`이며 root purpose와 다음 탐색 경로를 보여준다.
- map/diagnostic은 명시 `--mode`로만 내려간다.
- `docs search`의 selector는 기본 `--selector-scope=root`를 사용한다. `family` 또는 `owned` scope는 명시 opt-in이다.

## Write authority

- `docs status`, `docs collect`, `docs search`, `docs graph`, `docs drift`, `docs prd context`, and `docs bdd ...` are read-only.
- `docs prd scaffold` and `docs prd to-ralph-json` write only explicit output paths.
- `docs transform metadata` is dry-run preview by default and can only target definition markdown when explicit write mode exists.
- `docs prd sync-completion` is dry-run only.
