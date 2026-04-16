---
def:
  id: docs-control-plane
  level: module
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
    - target: docs-control-plane-plan
      type: contains
    - target: docs-control-plane-todo
      type: contains
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/command-groups/docs.commands.ts
  - packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts
  - packages/cli/src/lib/docs-control-plane/graph-types.ts
  - packages/cli/src/lib/docs-control-plane/graph-index.ts
  - packages/cli/src/lib/docs-control-plane/graph-normalize.ts
  - packages/cli/src/lib/docs-control-plane/graph-traverse.ts
  - packages/cli/src/lib/docs-control-plane/graph-presets.ts
  - packages/cli/src/lib/docs-control-plane/graph-scope.ts
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
- canonical document coordinate graph traversal

## 소비 ^consumes

- `definition-catalog-spec` — definition markdown의 좌표, frontmatter, contains/link 규칙
- `cli-command-spec` — command descriptor, help, dispatch 표면
- `docs-control-plane-plan` — control-plane 후속 roadmap
- `docs-control-plane-todo` — 실행 가능한 후속 작업 항목
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

## Traversal taxonomy

Docs graph traversal은 authored vocabulary를 대체하지 않고 `DocumentEnvelope[]`에서 만든 sidecar projection에 내부 분류 축만 추가한다. Canonical axes는 `composition`(contains/section), `refinement`(refines), `dependency`(depends_on), `constraint`(constrains/rule), `trace`(PRD/story/TODO/session lineage), `source`(code/file path), `evidence`(proof/artifact/verification), `role`(family document role), `context`(tags/coordinates)이다.

Direction은 `out`, `in`, `both`이고 axis 이름에 역방향 의미를 섞지 않는다. Edge는 항상 canonical `fromNodeId -> toNodeId`를 보존하며 traversal step만 역방향일 수 있다. `trace`, `source`, `evidence`는 별도 system axis다. PRD lineage가 코드 파일이나 proof artifact를 가리켜도 trace edge를 source/evidence로 합치지 않고, source refs와 evidence refs도 각각 자기 축으로 남긴다.

Node role은 `spec`, `todo`, `plan`, `rule`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json`, `ralph-session`, `source`, `evidence`, 필요한 경우 `section`이다. `rule`은 문서 역할이므로 role traversal에 포함되고, `.rule.md`는 같은 family spec을 향한 implicit `constraint` edge도 만든다.

Authored links는 source-owned 값으로 보존한다. Normalizer만 `contains→composition`, `refines→refinement`, `depends_on→dependency`, `constrains→constraint`, `traces_to|implements|evolves_from|supersedes→trace`, `verifies|materializes_output→evidence`로 매핑한다. `role`, `source`, `evidence`, `context` 중 상당수는 authored link가 아니라 envelope field와 adapter metadata에서 온 system axis다.

Presets `family`, `implementation`, `review`, `impact`, `prd-completion`은 convenience view이며 canonical axis가 아니다. 각 preset은 기존 axis와 direction/depth/context 기본값만 확장한다: `family=role+composition`, `implementation=trace+source+evidence`, `review=dependency+constraint+evidence+role`, `impact=in dependency+trace+source+evidence`, `prd-completion=trace+source+evidence`.

Source path target은 repository root 기준 relative path로 canonicalize한 뒤 indexed `source` node를 찾는다. Coverage가 없으면 broad repository fallback을 하지 않고 synthetic `source` node와 `source-map-missing` diagnostic만 반환한다. 이는 `qa-sdk def find-by-file`과 다르다. `find-by-file`은 `def sync`가 만든 DB-owned `code_references` explicit source-map만 읽고, mapping이 없거나 ambiguous하면 authoritative boundary를 확정하지 않는다.

Traversal guardrail: 기본 depth는 `1`, 최대 depth는 `6`; 기본 limit는 `100`, 최대 limit는 `500`이다. 초과 요청은 capped diagnostic을 남기며, cap에 걸린 결과는 `truncated: true`, legacy `omittedCount`, 세부 `omittedCounts.nodes|edges|depth`를 노출한다. `context` axis와 free-text search는 broad traversal로 취급하고 text output에서 warning을 표시한다.

## `qa-sdk def`와 `qa-sdk docs`

`qa-sdk def`는 definition markdown frontmatter와 synced/local/server datasource를 대상으로 단일 definition 문서, graph, boundary, context, validation을 다루는 primitive surface다. `qa-sdk def graph/context/boundary/find-by-file`는 단일 definition catalog datasource 안에서 좌표, 링크, contains 계층, code reference boundary를 묻는다. `qa-sdk docs graph`는 definition markdown, PRD markdown/JSON, ralph session, evidence registry를 함께 읽고 canonical traversal axis로 cross-document 좌표를 걷는다. `docs` command가 definition metadata를 해석할 때도 authoritative validation은 definition-catalog parser와 graph rules를 재사용한다.

Examples:

```bash
qa-sdk docs graph docs-control-plane --axis composition --direction out --depth 2
qa-sdk docs graph packages/cli/src/commands/docs.ts --axis source --direction both --json
qa-sdk docs graph checkout-evidence --axis evidence --direction both
qa-sdk docs graph checkout-spec --axis role --direction both
qa-sdk docs graph US-011 --axis trace --direction both --depth 3
```

## Adapter boundary

Supported adapters:

- `definition-markdown`: `.spec.md`, `.todo.md`, `.plan.md`, `.test.md`, `.memo.md`, `.rule.md`를 읽어 `def.*`, source refs, marker sections, links, diagnostics를 envelope로 투영한다.
- `prd-markdown`: `[PRD]...[/PRD]` markdown block의 overview, goals, quality gates, user stories, acceptance criteria, requirements, non-goals, open questions를 source-owned metadata/task로 보존한다.
- `ralph-prd-json`: ralph-tui가 소비하는 flat root JSON을 compatibility surface로 읽고 `userStories[]`를 tasks로 투영한다.
- `ralph-session`: `.ralph-tui/session-meta.json`을 transient local session envelope로 읽을 수 있다. 기본 drift/completion 검사는 repo-tracked SSOT만 대상으로 하며, session status/count drift는 `--include-session`이 명시될 때만 운영 신호로 포함한다.
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
- `docs drift`와 `docs prd sync-completion`의 기본값은 repo-tracked SSOT만 검사한다. ignored local runtime state인 `.ralph-tui/session-meta.json`은 `--include-session`이 있을 때만 포함한다.
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
