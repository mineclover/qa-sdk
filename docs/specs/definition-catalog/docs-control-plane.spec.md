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
    - target: docs-control-plane-rule
      type: contains
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/command-groups/docs.commands.ts
  - packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts
  - packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts
  - packages/cli/src/lib/docs-control-plane/graph-types.ts
  - packages/cli/src/lib/docs-control-plane/graph-index.ts
  - packages/cli/src/lib/docs-control-plane/graph-normalize.ts
  - packages/cli/src/lib/docs-control-plane/graph-traverse.ts
  - packages/cli/src/lib/docs-control-plane/graph-presets.ts
  - packages/cli/src/lib/docs-control-plane/graph-scope.ts
  - packages/cli/src/lib/docs-control-plane/graph-rank.ts
  - packages/cli/src/lib/docs-control-plane/graph-filter.ts
  - packages/cli/src/lib/docs-control-plane/graph-summary.ts
  - packages/cli/src/lib/docs-control-plane/role-matrix.ts
  - packages/cli/src/lib/deterministic-label-inventory-adapters.ts
  - packages/cli/src/lib/ontology-pack-docs-reader.ts
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

## Semantic coordinate candidates

Semantic coordinate candidate는 기존 repository id와 path 위에 얹는 read-only label projection이다. 후보 label은 configuration unit을 physical path와 독립적으로 가리키기 위한 값이며, 기존 `def.id`, `stableId`, `familyId`, source path, pack id, artifact id, PRD path, story id를 대체하거나 migration하지 않는다.

지원 label kind는 `definition-doc`, `source-file`, `ontology-pack`, `artifact`, `prd-markdown`, `ralph-prd-json`, `prd-story`, `evidence`이다. Candidate는 `originalId`와 `physicalRefs[]`를 함께 보존해야 하며, 같은 label이 서로 다른 physical record에서 나오면 collision diagnostic으로 보고한다. Missing kind, unsupported kind, invalid version, multiple primary physical refs도 diagnostic으로 남기고 source 파일을 수정하지 않는다.

Existing-id inventory는 `DocumentEnvelope`의 현재 필드를 migration 없이 투영한다. `def.id`, `stableId`, `familyId`, `sourcePath`, `packId`, `artifactId`, `sources[].path`, `evidence[].id`, PRD `tasks[].id`는 label candidate input이 되고, markdown path, source path, PRD path, artifact ref, artifact output path는 `physicalRefs[]`로 남는다. 같은 label이 여러 physical record에서 나오면 overwrite하지 않고 collision diagnostic으로 보고한다. Archive PRD와 transient `.ralph-tui` session state는 기본 inventory에서 제외하며, 정확한 path/id target이나 `includeArchive`/`includeSession` 같은 opt-in policy가 있을 때만 포함한다.

Deterministic label record는 semantic coordinate candidate를 감싼 read-only projection이다. Record는 `label`, candidate `kind`, `currentState`, `physicalRefs[]`, `dependencyLabels[]`, `sourceRefs[]`, `evidenceRefs[]`, `diagnostics[]`를 포함한다. 현재 record construction은 candidate-only 상태를 `DRAFT`로 기본화하고, dependency/source/evidence ref 배열은 정규화, 중복 제거, 정렬만 수행한다. 이 단계는 append-only registry 저장, transition event write, PRD/TODO promotion, archive 이동을 수행하지 않는다.

`DocumentEnvelope` → deterministic label record projection은 candidate projection 위에 관계 ref를 얹는 system transform이다. Definition markdown, PRD markdown, ralph PRD JSON envelope에서 생성된 candidate를 record로 감싸고, authored `links[]`는 dependency label ref 후보, `sources[]`와 PRD context source는 source label ref 후보, `evidence[]`와 task evidence id는 evidence label ref 후보로 투영한다. Record metadata에는 source-owned document id/path와 함께 active/archive/session scope, completed-record context를 보존한다. 이 projection도 read-only이며 FSM readiness 입력만 준비하고 상태 전이 authority를 갖지 않는다.

Ontology pack/artifact projection은 같은 record shape에 `ontology pack validate` 결과를 얹는다. 기본 입력은 CLI known-pack id 목록이며, 각 pack record는 validate 결과의 identity, component schema, system bindings, runtime summary, readiness status를 metadata로 보존한다. Validate issue는 record diagnostic으로 투영하고, source-map/docs readiness warning은 warning diagnostic으로 유지한다. Artifact evidence `DocumentEnvelope`가 함께 주어지면 artifact/evidence record를 생성하고 matching `packId`/`ontologyId`를 가진 pack record의 `evidenceRefs[]`에 연결한다. 이 projection은 pack activation, registry allocation, known-pack registry 수정을 수행하지 않는다.

FSM readiness projection은 deterministic label record list 위에서만 동작하는 read-only system transform이다. `computeDeterministicLabelReadiness()`는 `DRAFT -> LINTED -> RESOLVED -> ACTIVE` 순서로 gate를 평가하고, lint gate는 candidate/document validation diagnostic과 syntax/frontmatter/schema/doc-type metadata signal을, resolve gate는 dependency/source/evidence label resolution과 pack docs/source-map readiness를, activate gate는 drift-free status, required evidence, role quality placeholder, ontology pack runtime validity를 사용한다. `DEPRECATED`와 `ARCHIVED`는 metadata/currentState에서 terminal state로 계산한다. 실패한 gate는 `deterministic-label-readiness-blocked` diagnostic으로 남기고 마지막 valid state를 유지하며, read-only 단계에서는 `BLOCKED` state로 currentState를 바꾸거나 transition event를 write하지 않는다.

Transition dry-run은 같은 label record list와 gate evaluator 위에서 동작하는 read-only preview다. 요청 shape는 `targetLabel`, `requestedState`, `reason`, `evidenceRefs[]`를 가진다. 결과 shape는 `mode: "dry-run"`, `accepted`, `decision: "accepted" | "rejected"`, `currentState`, `nextState`, `blockers[]`, `gateEvidence[]`, `evidenceRefs[]`, `metadata`를 가진다. 요청 evidence refs는 평가용 record copy에만 합쳐지며 label record, definition markdown, PRD, TODO, ontology pack registry, append-only registry를 수정하지 않는다. 결과 metadata에는 `mutationTargets: { labels: false, documents: false, prds: false, registries: false }`와 append-only event schema 후보가 포함된다.

Append-only transition event schema 후보는 `deterministic-label-transition-event:candidate-v1`이다. 필드 후보는 `eventId`, `targetLabel`, `requestedState`, `currentState`, `nextState`, `decision`, `reason`, `evidenceRefs`, `gateEvidence`, `blockers`이며, `actor`, `sequence`, `committedAt`, `registryRevision`은 persistence/controller PRD가 생길 때까지 deferred field로 둔다.

Canonical format examples:

| 형상 단위 | 후보 label |
|-----------|------------|
| Definition doc | `urn:def:spec:docs-control-plane:v1` |
| Source file | `urn:source:typescript:packages/cli/src/commands/docs.ts` |
| Ontology pack | `urn:pack:ontology:programming-artifact-ontology:v1` |
| Artifact | `urn:artifact:activation-evidence:programming-artifact-ontology:v1` |
| PRD markdown | `urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1` |
| Ralph PRD JSON | `urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1` |
| PRD story | `urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-001` |
| Evidence | `urn:artifact:evidence:checkout-proof:v1` |

## Document Boundary Rules

문서 모듈화와 관리 단위의 소비 규칙은 `docs-control-plane-rule`이 소유한다. 이 spec은 docs control-plane의 현재 구조와 command surface를 정의하고, rule 문서는 Entity-like identity, Component-like data, System-like transform 분리 기준을 반복 적용 가능한 authoring rule로 고정한다.

## Traversal taxonomy

Docs graph traversal은 authored vocabulary를 대체하지 않고 `DocumentEnvelope[]`에서 만든 sidecar projection에 내부 분류 축만 추가한다. Canonical axes는 `composition`(contains/section), `refinement`(refines), `dependency`(depends_on), `constraint`(constrains/rule), `trace`(PRD/story/TODO/session lineage), `source`(code/file path), `evidence`(proof/artifact/verification), `role`(family document role), `context`(tags/coordinates)이다.

Direction은 `out`, `in`, `both`이고 axis 이름에 역방향 의미를 섞지 않는다. Edge는 항상 canonical `fromNodeId -> toNodeId`를 보존하며 traversal step만 역방향일 수 있다. `trace`, `source`, `evidence`는 별도 system axis다. PRD lineage가 코드 파일이나 proof artifact를 가리켜도 trace edge를 source/evidence로 합치지 않고, source refs와 evidence refs도 각각 자기 축으로 남긴다.

Node role은 `spec`, `todo`, `plan`, `rule`, `cases`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json`, `ralph-session`, `source`, `evidence`, 필요한 경우 `section`이다. `rule`은 문서 역할이므로 role traversal에 포함되고, `.rule.md`는 같은 family spec을 향한 implicit `constraint` edge도 만든다.

`docs status <doc-id> --json`은 scoped family의 role matrix를 `roleCoverage`로 노출한다. Matrix role은 `spec`, `plan`, `todo`, `rule`, `cases`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json`이고, 같은 `familyId`의 파일은 `sameFamily`, 직접 `contains/refines/traces_to`로 닿는 문서는 `linked`로 분리한다. Archive PRD markdown/JSON과 transient session state는 active role coverage에서 기본 제외한다.

Authored links는 source-owned 값으로 보존한다. Normalizer만 `contains→composition`, `refines→refinement`, `depends_on→dependency`, `constrains→constraint`, `traces_to|implements|evolves_from|supersedes→trace`, `verifies|materializes_output→evidence`로 매핑한다. `role`, `source`, `evidence`, `context` 중 상당수는 authored link가 아니라 envelope field와 adapter metadata에서 온 system axis다.

Presets `family`, `implementation`, `review`, `impact`, `prd-completion`은 convenience view이며 canonical axis가 아니다. 각 preset은 기존 axis와 direction/depth/context 기본값만 확장한다: `family=role+composition`, `implementation=trace+source+evidence`, `review=dependency+constraint+evidence+role`, `impact=in dependency+trace+source+evidence`, `prd-completion=trace+source+evidence`.

Source path target은 repository root 기준 relative path로 canonicalize한 뒤 indexed `source` node를 찾는다. Coverage가 없으면 broad repository fallback을 하지 않고 synthetic `source` node와 `source-map-missing` diagnostic만 반환한다. 이는 `qa-sdk def find-by-file`과 다르다. `find-by-file`은 `def sync`가 만든 DB-owned `code_references` explicit source-map만 읽고, mapping이 없거나 ambiguous하면 authoritative boundary를 확정하지 않는다.

Traversal guardrail: 기본 depth는 `1`, 최대 depth는 `6`; 기본 limit는 `100`, 최대 limit는 `500`이다. 초과 요청은 capped diagnostic을 남기며, cap에 걸린 결과는 `truncated: true`, legacy `omittedCount`, 세부 `omittedCounts.nodes|edges|depth`를 노출한다. `context` axis와 free-text search는 broad traversal로 취급하고 text output에서 warning을 표시한다.

## Graph result ranking and filtering

Docs graph ranking is a post-traversal result consumption model. `traverseDocumentGraph()` first resolves the target, walks the requested canonical axes, and returns raw `nodes`, `edges`, `paths`, role groups, counts, truncation fields, and diagnostics. Only after that raw traversal exists does `rankDocumentGraphTraversal()` score nodes and `filterDocumentGraphRanking()` build an active view. Ranking and filtering do not rewrite authored links, canonical axes, graph edges, paths, or graph truth.

The ranking algorithm is deterministic rule-based rescoring (`docs-graph-rule-rank-v1`). It is not semantic reranking, vector search, embedding search, or LLM judgment. Score factors are fixed data already present in the traversal result: target match, path distance, strongest path axis, node kind, same-family role metadata, archive state, diagnostics, and follow-up category. Ranking emits `rank`, `score`, `strength`, `factors`, and `reasonSummary` so operators can inspect why a node moved up or down. The output order is for consumption only; the raw traversal remains the audit source.

The JSON compatibility contract is additive. `nodes`, `edges`, `paths`, traversal `counts`, `truncated`, `omittedCount`, `omittedCounts`, `diagnostics`, `roleGroups`, and `missingRoles` remain available even when ranked or filtered views are present. View fields are `ranking`, top-level `rankedNodes`, `filtering`, `filteredNodes`, and `summary`.

Post-traversal view filters apply to ranked/filtered result views and graph-derived command output. `--axis` selects which axes traversal may walk. `--filter-axis` filters already traversed ranked nodes by path axis and cannot discover new nodes. `--kind` matches node/document kind, `--role` matches family role metadata or role-like file suffixes, and `--follow-up-category` matches TODO/follow-up category metadata. `--include-archive` opts archived or historical nodes back into the active view; without it, ranked/filtered views exclude documents whose lifecycle/status/path marks them archived or historical.

Active inventory defaults use the same principle at the document-set layer. `docs/specs/**` and active `tasks/**/prd-*` files are active by default, while `tasks/archive/**`, archived lifecycle records, and transient `.ralph-tui` session state are excluded unless an explicit target or opt-in flag brings them in. In normal graph traversal, an archived node may still appear in raw `nodes` if traversal found it; the default active ranked view filters it out for consumption.

Examples:

```bash
# Source ranking: retrieve source edges, then rank source-backed docs above broad context.
qa-sdk docs graph packages/cli/src/commands/docs.ts --axis source --direction in --json

# Role ranking: family role docs score strongly, especially same-family TODO/plan/rule docs.
qa-sdk docs graph docs-control-plane --preset family --filter-axis role --role spec,todo,plan --json

# Evidence ranking: evidence-linked proof ranks above weak trace/context matches.
qa-sdk docs graph programming-artifact-ontology-system --axis evidence --direction both --json

# PRD context ranking: exact-doc authoring context consumes the ranked graph view
# before flattening specs, TODOs, plans, source refs, and evidence refs.
qa-sdk docs prd context docs-control-plane --filter-axis role,source,evidence --json
```

## Topdown lifecycle inventory

Topdown lifecycle inventory는 future cleanup PRD를 안정적으로 고르기 위한 반복 가능한 운영 pass다. 구현이나 아카이브를 직접 수행하는 command가 아니라, active 문서 family를 위에서 아래로 읽어 role coverage, TODO operational bucket, completed-record candidate, source/evidence proof, drift 상태를 같은 순서로 기록하는 control-plane 사용법이다.

Active scope는 repository-owned documentation과 active PRD execution record로 한정한다.

- `docs/specs/**` definition markdown은 active inventory다. `lifecycle: archived` 문서와 docs archive directory 아래 문서는 기본 제외한다.
- `tasks/**/prd-*.md`와 `tasks/**/prd-*.json`은 active PRD inventory다.
- `tasks/archive/**` PRD markdown/JSON은 기본 제외한다.
- `.ralph-tui/session-meta.json` 같은 transient session state는 기본 제외하고, `--include-session`이 있을 때만 drift/completion 운영 신호로 포함한다.
- Archive PRD, archived doc, transient session은 정확한 path/id target이나 opt-in flag 없이는 active inventory, role coverage, drift/completion 판단으로 승격하지 않는다.

Traversal order는 leaf 파일 검색에서 시작하지 않는다. Entry group 또는 module root에서 시작하고, contained module을 먼저 읽은 뒤, 같은 family role docs(`spec`, `plan`, `todo`, `rule`, `cases`, `test`, `memo`, `knowledge`, active PRD markdown, active ralph PRD JSON)를 읽는다. Direct leaf docs와 source/evidence reference는 마지막에 proof로 확인하며 inventory root로 쓰지 않는다.

Operational TODO state는 checkbox marker가 아니라 heading category에서 온다. Checkbox state는 binary다: `[ ]`는 open, `[x]`/`[X]`는 completed이다. `docs status`는 heading stack의 canonical categories(`Completed — 완료 기록`, `Actionable — 실행 가능`, `Deferred — 조건부 대기`, `Parking Lot — 후보 보관`)를 `nextFollowUps[].category`로 투영하고, checkbox 자체에 deferred/parking/archived/promotion state를 넣지 않는다. `completedRecords[]`도 read-model candidate다. 전체 `.todo.md`가 checked-only이거나 paired PRD JSON stories가 모두 passing이면 candidate로 보고하지만, 파일 이동, archive 전환, TODO 체크, spec promotion을 자동 수행하지 않는다.

Repeatable inventory and validation commands:

```bash
pnpm --filter @qa-sdk/cli test -- docs
pnpm --filter @qa-sdk/cli typecheck
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js def validate

node packages/cli/dist/index.js docs status docs-control-plane --json
node packages/cli/dist/index.js docs status operational-ontology-registry-allocation --json
node packages/cli/dist/index.js docs status programming-artifact-ontology-system --json
node packages/cli/dist/index.js docs status authorization-ontology-system --json

node packages/cli/dist/index.js docs drift --prd tasks/prd-document-coordinate-graph-traversal.json --json
node packages/cli/dist/index.js docs drift --prd tasks/prd-document-source-map-coverage-expansion.json --json
```

Inventory results may be recorded in a maintained memo, such as `topdown-lifecycle-inventory-report`, or in the owning plan. They remain documentation evidence for a later human-reviewed cleanup PRD; they are not automatic archival authority and not automatic TODO/spec promotion authority.

## Completed record lifecycle policy

`completedRecords[]` is a read-only lifecycle candidate projection. It identifies records that appear complete enough for human review, such as a checked-only `.todo.md` or PRD markdown paired with ralph PRD JSON whose stories all pass. The projection does not mutate the repository and does not own lifecycle transition authority.

Completed records are not active follow-up work. `docs status` and `docs collect` may surface them for review, but they must not be promoted into `nextFollowUps[]`, affect `nextFollowUp` priority, or imply that a maintainer should continue implementation from that record.

Completed records are not automatically moved, archived, converted to `.memo.md`, checked, unchecked, or promoted into spec content. `passes: true` in ralph PRD JSON is only a completion signal for the compatibility read model; it is not authority to promote TODOs, convert PRDs, rewrite definition documents, or perform archive/memo lifecycle changes.

`docs drift` reports completed-record lifecycle candidates as `info`, not as `warning` or `error`. The current policy is that checked-only `.todo.md` records and PRD markdown paired with all-passing ralph PRD JSON are cleanup-review signals: they should be visible to operators, but they must not fail drift checks or change existing drift warning/error behavior. Future policies may introduce warnings only for contradictory source state; the base completed-record candidate remains informational.

Completed-record drift reporting uses the same active-scope defaults as `completedRecords[]`: archive PRDs and `archive/` paths are excluded by default, transient `.ralph-tui` session state is excluded unless explicitly opted in by session-aware workflows, and `--prd <file>` limits completed-record candidates to that PRD family.

Archive and memo conversion require a separate explicit PRD, command, or reviewed write workflow that names the target records and owns the mutation. Until such authority exists, completed records stay in place as review candidates and documentation evidence.

## Completed record manual review workflow

Completed-record review is a manual maintainer workflow, not a CLI lifecycle mutation. The control-plane commands identify candidates and collect evidence; a human reviewer decides whether each source record should stay where it is, be archived by a future write workflow, or be converted into memo/knowledge material by a future write workflow.

1. Inspect candidate output. Run `node packages/cli/dist/index.js docs status <target> --json` for the owning family and read `completedRecords[]`, `roleCoverage`, `nextFollowUp`, and `nextFollowUps[]`. Then run `node packages/cli/dist/index.js docs collect <target> --family-only --json` to inspect the same-family role docs, direct module children, source refs, and evidence refs without broad graph traversal.
2. Verify candidate state. Open the candidate source file and confirm the completion signal still matches the source-owned record: checked-only `.todo.md` files must have zero open checkboxes and at least one checked checkbox, and completed PRD markdown must still be paired with ralph PRD JSON whose stories all pass. Run `node packages/cli/dist/index.js docs drift --prd <prd-file> --json` when the candidate is PRD-scoped, and treat completed-record drift issues as review evidence rather than validation failures.
3. Decide keep, archive, or memo. Leave a completed TODO in place when it is the clearest audit trail for recently finished work, when it carries useful implementation evidence not yet represented in a spec/plan/memo, when it is still part of an active family review, or when no approved cleanup PRD names that record for movement. Choose archive only for stale execution records whose operational value is historical and whose references will remain discoverable after movement. Choose memo/knowledge conversion only when the completed record contains durable rationale, review notes, or decision context that should remain readable outside TODO syntax.
4. Create a future conversion PRD when cleanup is broader than a one-record editorial change. A PRD is required when the review would move or convert multiple records, define an archive directory or memo naming convention, change links/frontmatter, alter role coverage expectations, or create a reusable write command. That PRD must name the target records, define the write authority, preserve source/evidence links, and include the validation commands that prove `docs status`, `docs collect --family-only`, and `docs drift` still report the intended active inventory.
5. Commit reviewed changes intentionally. Commit only the human-approved documentation edits, archive moves, or memo conversions from the explicit cleanup scope, and include the command evidence used for review in the PR or commit notes. Do not commit generated archive/memo changes from `docs status`, `docs collect`, or `docs drift`, because those commands are read-only and do not authorize repository mutation.

There is intentionally no automatic archive or memo command in this workflow. Adding one requires its own PRD and implementation story.

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

- `definition-markdown`: `.spec.md`, `.todo.md`, `.plan.md`, `.rule.md`, `.cases.md`, `.test.md`, `.memo.md`를 읽어 `def.*`, source refs, marker sections, links, diagnostics를 envelope로 투영한다.
- `prd-markdown`: `[PRD]...[/PRD]` markdown block의 overview, goals, quality gates, user stories, acceptance criteria, requirements, non-goals, open questions를 source-owned metadata/task로 보존한다.
- `ralph-prd-json`: ralph-tui가 소비하는 flat root JSON을 compatibility surface로 읽고 `userStories[]`를 tasks로 투영한다.
- `ralph-session`: `.ralph-tui/session-meta.json`을 transient local session envelope로 읽을 수 있다. 기본 drift/completion 검사는 repo-tracked SSOT만 대상으로 하며, session status/count drift는 `--include-session`이 명시될 때만 운영 신호로 포함한다.
- `artifact-evidence`: local artifact registry JSON을 evidence envelope로 읽고 source/test/evidence relation을 보존한다.

Adapters are read-only. Adapter가 source markdown, PRD JSON, session file, artifact registry를 수정하거나, 다른 source schema로 변환하거나, source vocabulary를 neutral enum으로 치환하지 않는다.

## Command assembly convention

`packages/cli/src/commands/*.ts` files are command assembly and presentation surfaces. They parse CLI arguments, dispatch to focused handlers or library functions, print text/JSON output, and set exit codes. Reusable read-model construction, parser/ranking logic, transformation previews, renderer logic, path policy, readiness checks, and validation summaries belong in internal CLI modules under `packages/cli/src/lib/**` or focused command-handler modules under `packages/cli/src/commands/**`.

Current docs-control-plane extraction follows this rule: `packages/cli/src/commands/docs.ts` owns command flow and output formatting, while `packages/cli/src/lib/docs-control-plane/` owns adapters, family scope, role matrix assembly, TODO lifecycle parsing, completed-record detection, follow-up ranking, graph traversal, drift checks, metadata transform previews, and PRD compatibility transforms. Ontology pack authoring follows the same rule: `packages/cli/src/commands/ontology.ts` remains the router, `packages/cli/src/commands/ontology/pack-authoring.ts` owns pack command printing and exit-code policy, and `packages/cli/src/lib/ontology-pack-*` owns scaffold planning/rendering/writing and pack loading/runtime/readiness validation.

Extracted modules in this refactor are internal CLI libraries. They may be imported by CLI command code and focused CLI tests, but this refactor does not require package-level public exports. Promotion to a public package API requires a separate PRD or explicit interface spec.

Readiness-style JSON results use a stable top-level convention: `valid` is the command gate, `issues` is the flat ordered diagnostic list, `runtime` summarizes runtime contract validation, and `readiness` summarizes implementation/test/docs/source-map preparedness. Warning-level readiness issues can leave `valid: true`; error-level issues make the command invalid.

Scaffold-like commands are dry-run first. Dry-run returns the same planned file/candidate/readiness shape that write mode consumes and does not mutate the filesystem. Write mode requires an explicit flag such as `--write`, materializes only planned files, refuses unsafe paths and existing outputs, and leaves resolver/source-map/activation/registry mutation as candidate output or separate explicit commands.

Identity/data/system separation is an implementation organization guideline, not an ECS-only architecture. Identity modules define stable ids and symbols, data modules define read models or schema declarations, and system modules perform explicit transforms such as parsers, renderers, validators, projectors, readiness collectors, or writers. ECS is only one architecture that can be modeled by operational ontology packs; docs and ontology CLI modules use the separation without requiring ECS scheduling, archetypes, or storage layout.

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
- `docs prd sync-completion --family-only`은 입력 PRD markdown/JSON family에서 시작해 직접 연결된 role-matrix 문서와 그 active family role context만 affected docs로 확장한다. Candidate reason은 `target`, `role`, `composition`, `trace`, `source`, `evidence`로 축을 구분하고, transient session은 `--include-session`일 때만 `session`으로 보고한다.
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
