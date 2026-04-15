---
def:
  id: docs-control-plane
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [cross-scope, contract, testing]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: cli-command-spec
      type: depends_on
---

# Docs Control Plane

## 목적 ^purpose

`qa-sdk docs`가 definition markdown, PRD markdown, ralph PRD JSON, ralph session, evidence registry를 하나의 neutral read model로 모아 보는 cross-document control plane임을 고정한다. `qa-sdk def`의 definition-catalog primitive와 PRD 실행 호환 포맷을 혼동하지 않도록 adapter boundary, SSOT 방향, dry-run-first write policy를 문서화한다.

## 정의 ^defines

- `qa-sdk docs` CLI control plane
- source-owned document adapters
- neutral `DocumentEnvelope` read model
- ralph PRD JSON compatibility adapter
- dry-run metadata transform policy
- PRD authoring command 선택 기준

## 소비 ^consumes

- `definition-catalog-spec` — definition markdown의 좌표, frontmatter, contains/link 규칙
- `cli-command-spec` — command descriptor, help, dispatch 표면
- repository files — definition markdown, PRD markdown, ralph JSON, session metadata, artifact registry

## SSOT 방향

Docs control plane은 source of truth가 아니다. Repository 파일과 기존 side store가 source of truth이고, control plane은 읽기/상관/미리보기만 담당한다.

```text
definition markdown      ┐
PRD markdown             │
ralph PRD JSON           ├─ read-only adapters
ralph session metadata   │
artifact evidence JSON   ┘
        ↓
DocumentEnvelope[]
        ↓
qa-sdk docs status / collect / search / drift / prd / transform
```

Adapter는 source vocabulary를 소유하지 않는다. `kind`, `status`, relation `type`, diagnostic `severity`, PRD story fields, artifact relation fields 같은 값은 plain string metadata로 보존하고, control plane은 identity, path, family, default collection, command-level correlation만 정규화한다.

## `qa-sdk def`와 `qa-sdk docs`

| 표면 | 역할 | 입력 | 출력 |
|------|------|------|------|
| `qa-sdk def` | definition-catalog primitive | definition markdown frontmatter + synced/local/server datasource | 단일 definition 문서, graph, boundary, context, validation |
| `qa-sdk docs` | cross-document control plane | definition markdown + PRD markdown/JSON + session + evidence adapters | family status, drift, PRD context, scaffold, compatibility conversion, dry-run transforms |

`qa-sdk def`는 definition 문서 자체의 좌표, 링크, 계층, code reference를 다룬다. `qa-sdk docs`는 여러 문서 family와 실행 sidecar를 함께 읽어 PRD 중심 drift를 줄이고, 필요한 후속 작업을 제안한다. `docs` command가 definition metadata를 해석할 때도 authoritative validation은 definition-catalog parser와 graph rules를 재사용한다.

## Adapter boundary

Supported adapters:

- `definition-markdown`: `.spec.md`, `.todo.md`, `.plan.md`, `.test.md`, `.memo.md`, `.rule.md`를 읽어 `def.*`, source refs, marker sections, links, diagnostics를 envelope로 투영한다.
- `prd-markdown`: `[PRD]...[/PRD]` markdown block의 overview, goals, quality gates, user stories, acceptance criteria, requirements, non-goals, open questions를 source-owned metadata/task로 보존한다.
- `ralph-prd-json`: ralph-tui가 소비하는 flat root JSON을 compatibility surface로 읽고 `userStories[]`를 tasks로 투영한다.
- `ralph-session`: `.ralph-tui/session-meta.json`을 읽어 PRD JSON story state와 session status/count drift를 diagnostic으로 낸다.
- `artifact-evidence`: local artifact registry JSON을 evidence envelope로 읽고 source/test/evidence relation을 보존한다.

Adapters are read-only. Adapter가 source markdown, PRD JSON, session file, artifact registry를 수정하거나, 다른 source schema로 변환하거나, source vocabulary를 neutral enum으로 치환하지 않는다.

## PRD JSON의 위치

PRD markdown이 authoring source다. Ralph PRD JSON은 ralph-tui 실행 호환 adapter의 target format이며 core document model이 아니다.

- PRD를 작성하거나 기획 맥락을 모을 때는 markdown PRD와 `docs prd context/scaffold`를 쓴다.
- ralph-tui 실행 입력이 필요할 때만 `docs prd to-ralph-json` 또는 ralph-tui create-json workflow로 JSON을 만든다.
- 생성된 JSON은 flat root `name`, `branchName`, `description`, `userStories[]` shape를 가져야 한다.
- JSON story의 `passes: true`는 completion candidate signal일 뿐이며, definition TODO/spec promotion authority가 아니다.

## Dry-run-first write policy

기본 정책은 no hidden write다.

- `docs status`, `docs collect`, `docs search`, `docs drift`, `docs prd context`는 read-only다.
- `docs transform metadata`는 dry-run이 기본이고 현재 `--apply`를 지원하지 않는다. 결과는 projected frontmatter와 `DocumentChangeSet` preview이며 source 파일은 바꾸지 않는다.
- `docs prd sync-completion`은 dry-run only다. `passes: true` story는 후보 문서와 blocked/eligible promotion state를 계산하지만, TODO 체크나 spec promotion을 자동 반영하지 않는다.
- `docs prd scaffold`는 explicit `--output <file>`이 있을 때 markdown skeleton만 작성한다. ralph PRD JSON은 만들지 않는다.
- `docs prd to-ralph-json`은 explicit `--output <prd.json>`이 있을 때만 ralph-compatible JSON을 쓰고, 쓰기 전 target adapter validation을 통과해야 한다.

## Metadata transform allowlist

`qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run]`가 지원하는 rule surface:

- top-level keys: `select` 또는 `match`, `set`, `tags`, `links`, `sources`
- selector keys: `ids`, `stableIds`, `defIds`, `paths`, `familyIds`, `kinds`, `metadata`
- `set`: `lifecycle`, `level`, `svc`, `sources`
- `tags`: string array 또는 `{ add, remove }`
- `links`: `{ add, remove }` with link types `depends_on`, `implements`, `refines`, `constrains`, `traces_to`, `contains`, `evolves_from`, `supersedes`
- `sources`: string array 또는 `{ set, add, remove }`

Protected fields: `id`, `def.id`, `defId`. Transform preview targets definition markdown only; PRD JSON, PRD markdown, session, and evidence sources are refused.

## PRD command 선택 기준

| 명령 | 사용할 때 | 쓰기 여부 |
|------|-----------|-----------|
| `qa-sdk docs prd context <topic|doc-id>` | 새 PRD를 쓰기 전에 관련 specs, TODO, plans, prior PRDs, PRD JSON state, session state, scenario rows, source/evidence를 모을 때 | read-only |
| `qa-sdk docs prd scaffold <topic|doc-id> --output <file.md>` | 수집된 context를 바탕으로 markdown PRD skeleton을 시작할 때 | explicit markdown write |
| `qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json>` | 승인된 markdown PRD를 ralph-tui 실행 입력으로 변환할 때 | explicit compatibility JSON write |

## 범위 밖

- REST API 또는 remote document service
- database migration 또는 persistent docs control-plane store
- adapter write path
- automatic unreviewed TODO/spec promotion
- PRD JSON을 core document model로 승격하는 작업
