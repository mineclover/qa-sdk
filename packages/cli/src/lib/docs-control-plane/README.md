# Docs Control Plane

이 모듈은 문서형 source를 하나의 neutral envelope로 조회하기 위한 local CLI
support boundary다. Definition docs, PRD, ralph JSON, session, evidence,
diagnostic을 원본 schema 병합이나 대체 없이 표현한다.

Repository 파일이 source of truth다. Control plane은 index/coordination layer일
뿐이다. Adapter는 source 파일이나 기존 store를 읽어 `DocumentEnvelope`를 만들고,
`kind`, `status`, relation `type`, diagnostic `severity` 같은 source-owned
vocabulary를 plain string field로 보존한다.

## Traversal taxonomy

Graph traversal uses canonical axes only inside the control plane:
`composition`, `refinement`, `dependency`, `constraint`, `trace`, `source`,
`evidence`, `role`, and `context`. Direction is separate and limited to
`out`, `in`, or `both`; axis names never encode reverse traversal.

Document roles are node kinds, not edge labels: `spec`, `todo`, `plan`,
`rule`, `cases`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json`,
`ralph-session`, `source`, `evidence`, and optional `section` nodes.
Authored link vocabulary remains source-owned. Values like `contains`,
`depends_on`, `implements`, `refines`, `constrains`, `traces_to`,
`evolves_from`, and `supersedes` are preserved on edges and mapped to
canonical axes only for traversal. Presets such as `family`, `impact`, and
`prd-completion` are convenience views over those axes, not new axes.

| Preset | Axes | Direction | Depth | Context |
|--------|------|-----------|-------|---------|
| `family` | `role`, `composition` | `both` | 2 | excluded |
| `implementation` | `trace`, `source`, `evidence` | `both` | 2 | excluded |
| `review` | `dependency`, `constraint`, `evidence`, `role` | `both` | 2 | excluded |
| `impact` | `dependency`, `trace`, `source`, `evidence` | `in` | 2 | excluded |
| `prd-completion` | `trace`, `source`, `evidence` | `both` | 2 | excluded |

## Traversal guardrails

Graph traversal is bounded by default so a large repository does not produce a
full graph dump by accident. The default depth is `1` and the maximum enforced
depth is `6`; preset defaults may be lower but explicit `--depth` values above
the maximum are capped with a diagnostic. The default returned-node limit is
`100` and explicit `--limit` may lower or raise it up to the enforced maximum of
`500`.

Traversal results expose `truncated`, legacy `omittedCount` for node-limit
omissions, and detailed `omittedCounts` for nodes, edges, and depth-frontier
nodes hidden by caps. Text output prints the same truncation detail. The
`context` axis and free-text search are intentionally broad, so text output
warns operators to keep `--depth` and `--limit` tight or choose stricter axes.

`--family-only` is an inventory scope, not a graph preset. On `docs status`,
`docs collect`, and `docs prd context`, it limits the document set to
same-family role documents plus direct `contains` children when the target
document is a module. On `docs prd sync-completion`, it starts with the explicit
PRD markdown/JSON family, adds directly linked role-matrix documents, and then
adds same-family role context for those linked active families. Archive PRDs are
excluded from this active family scope unless explicitly targeted, and
`.ralph-tui` session state remains out of scope unless `--include-session` is
also passed. `docs collect --graph --family-only` returns a compact graph
summary for the family-only document set; omitting `--family-only` keeps the
normal graph traversal behavior.

`docs status <doc-id> --json` also emits `roleCoverage` for the target family.
It reports the active matrix roles `spec`, `plan`, `todo`, `rule`, `cases`,
`test`, `memo`, `knowledge`, `prd`, and `ralph-prd-json`, separating
same-family files from directly linked `composition`, `refinement`, and `trace`
documents. Archive PRDs are excluded from active coverage by default.

Source traversal is powered by docs control-plane adapters (`DocumentEnvelope`
sources, metadata source refs, PRD/session paths, and artifact evidence refs).
It is intentionally broader than, and distinct from, `qa-sdk def find-by-file`,
which reads DB-owned `code_references` explicit source maps only.

## Post-traversal result views

Graph traversal is the retrieval phase. Ranking, filtering, and summaries run
only after `traverseDocumentGraph()` has returned its raw result. These result
views do not rewrite `DocumentEnvelope.links`, change
`CANONICAL_TRAVERSAL_AXES`, or rebuild graph edges; they consume the traversal
result and add JSON fields beside it. Ranking changes result consumption order,
not graph truth.

The JSON compatibility contract is that raw traversal fields (`nodes`, `edges`,
`paths`, traversal `counts`, truncation fields, diagnostics, role groups, and
missing roles) remain the full unfiltered traversal output. Ranked and filtered
views are additive fields: `ranking`, `rankedNodes`, `filtering`,
`filteredNodes`, and `summary`.

Reranking is deterministic, post-traversal, and rule-based
(`docs-graph-rule-rank-v1`). It uses fixed factors from the traversal result:
target node, path distance, strongest path axis, node kind, same-family role
metadata, archive state, diagnostics, and follow-up category. It emits `rank`,
`score`, `strength`, `factors`, and `reasonSummary` for each ranked node. It
does not use LLM, vector, embedding, or semantic ranking, so the same raw graph
result and filter options produce the same ranked view.

Ranking strengths are labels for consumption priority: target and strong
same-family/source/evidence matches generally rise; broad context-only,
archived, historical, deprecated, diagnostic-heavy, deferred, parking-lot, or
completed follow-up records are penalized. These labels are not validation
truth and must not be used to mutate source documents automatically.

## Result view filters

Graph filters are post-traversal view filters. `--axis` selects the axes used
while traversing the graph; `--filter-axis` filters the ranked/filtered result
view after traversal has already completed. The raw traversal fields stay
unchanged so operators can audit the full retrieval set.

`docs graph`, `docs collect --graph`, and `docs prd context` support
`--kind`, `--role`, `--filter-axis`, and `--follow-up-category` as comma
separated filters. Active ranked/filtered views exclude archive documents by
default; pass `--include-archive` to include archived documents explicitly.

Filter scope:

| Option | Scope | Notes |
|--------|-------|-------|
| `--axis` | traversal input | Selects which canonical axes may be walked; can change raw `nodes`, `edges`, and `paths`. |
| `--filter-axis` | result view | Keeps ranked nodes whose path contains the listed axes; cannot discover new nodes. |
| `--kind` | result view | Matches graph node kind and document kind metadata. |
| `--role` | result view | Matches family role metadata, role-like document kinds, or role-like file suffixes. |
| `--follow-up-category` | result view | Matches TODO/follow-up metadata such as `actionable`, `deferred`, or `parking-lot`. |
| `--include-archive` | result view | Includes archived/historical/deprecated records in ranked/filtered views. |

Archive behavior has two layers. Active inventory commands exclude archived
definition docs, `tasks/archive/**` PRDs, and transient `.ralph-tui` session
state by default unless an explicit target or opt-in flag brings them in.
Graph traversal may still find an archived node in raw traversal fields; the
default active ranked/filtered view excludes that node until `--include-archive`
is passed.

Examples:

```bash
# Source ranking: retrieve source edges, then rank source-backed docs above
# broad context-only matches while keeping raw traversal nodes/edges/paths.
qa-sdk docs graph packages/cli/src/commands/docs.ts --axis source --direction in --json

# Role ranking: consume the family graph as same-family role context.
qa-sdk docs graph docs-control-plane --preset family --filter-axis role --role spec,todo,plan --json

# Evidence ranking: proof/evidence nodes and evidence-linked docs outrank weak
# trace/context matches in the ranked view.
qa-sdk docs graph programming-artifact-ontology-system --axis evidence --direction both --json

# PRD context ranking: exact-doc authoring context consumes the ranked graph
# before flattening related specs, TODOs, plans, source refs, and evidence refs.
qa-sdk docs prd context docs-control-plane --filter-axis role,source,evidence --json
```

이 story는 REST endpoint, remote service, database migration, 새 artifact
vocabulary를 추가하지 않는다.

## Topdown lifecycle inventory

Topdown lifecycle inventory is the repeatable operating pass for choosing later
cleanup PRDs. It starts from stable entry group or module roots, records the
family role matrix, TODO operational buckets, completed-record candidates,
source/evidence proof, and drift state, then stores the result in a maintained
memo or owning plan. It is a read-model workflow; it does not archive documents,
check TODO boxes, or promote TODO/spec content.

Active scope is intentionally narrow:

- `docs/specs/**` definition markdown is active unless the document is archived.
- `tasks/**/prd-*.md` and `tasks/**/prd-*.json` are active PRD records.
- `tasks/archive/**` and archived documents are excluded by default.
- `.ralph-tui/session-meta.json` and other transient session state are excluded
  unless the command has `--include-session`.
- Archive or session records enter the inventory only through an explicit
  path/id target or opt-in flag.

TODO checkbox state stays binary. `[ ]` means open, and `[x]`/`[X]` means
completed. Operational state comes from section headings: `Completed — 완료 기록`,
`Actionable — 실행 가능`, `Deferred — 조건부 대기`, and
`Parking Lot — 후보 보관`. `docs status --json` projects those headings into
`nextFollowUps[].category`; checkbox syntax does not encode deferred,
parking-lot, archive, or promotion state. `completedRecords[]` is also only a
candidate read model for human review.

`docs drift` reports completed-record candidates as `info` issues. Checked-only
`.todo.md` records and PRD markdown paired with all-passing ralph PRD JSON are
operator cleanup signals, not validation failures; they must not affect command
exit status or existing warning/error drift behavior. The same default active
scope applies: archive PRDs and `archive/` paths are excluded, transient
`.ralph-tui` state stays out unless a session-aware flag opts in, and `--prd`
limits reporting to the selected PRD family.

## Completed record manual review

Completed-record review is a human workflow. The docs control-plane commands
find candidates and assemble evidence, but they do not move files, archive
records, convert records to `.memo.md`, or promote TODO content into specs.

Review flow:

1. Inspect the owning family with
   `node packages/cli/dist/index.js docs status <target> --json`. Read
   `completedRecords[]` beside `roleCoverage`, `nextFollowUp`, and
   `nextFollowUps[]` so completed records stay visible but non-actionable.
2. Inspect local context with
   `node packages/cli/dist/index.js docs collect <target> --family-only --json`.
   Use the family-only view to check same-family role docs, direct module
   children, source refs, and evidence refs.
3. Verify the source-owned completion signal. A completed TODO must still be
   checked-only with zero open checkboxes and at least one checked checkbox. A
   completed PRD markdown record must still have paired ralph PRD JSON with all
   stories passing. For PRD-scoped candidates, run
   `node packages/cli/dist/index.js docs drift --prd <prd-file> --json` and
   treat completed-record `info` issues as review evidence, not failures.
4. Decide whether to keep, archive, or convert. Keep a completed TODO in place
   when it is still the clearest audit trail, carries useful implementation
   evidence not represented elsewhere, remains part of an active family review,
   or has not been named by an approved cleanup PRD. Archive only stale
   execution records whose value is historical. Convert to memo/knowledge only
   when the record contains durable rationale, review notes, or decision
   context that should live outside TODO syntax.
5. Create a future archive/memo conversion PRD when the cleanup would affect
   multiple records, define archive or memo naming rules, change links or
   frontmatter, change role-coverage expectations, or introduce any reusable
   write command. That PRD must name target records, own the write authority,
   preserve source/evidence links, and list the validation commands.
6. Commit only the reviewed documentation edits, archive moves, or memo
   conversions from the explicit cleanup scope. `docs status`,
   `docs collect --family-only`, and `docs drift` are command evidence; they are
   not automatic archive or memo commands.

Inventory and validation commands:

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

## Boundary

- `DocumentEnvelope`는 normalized read model이다.
- `DocumentAdapter`는 read-only collection method만 노출한다.
- `DocumentAdapterCapabilities`는 adapter의 write/transform 가능 여부만 선언한다.
  Control plane 자체는 write path를 만들지 않는다.
- `DocumentChangeSet`은 future adapter가 write/transform을 명시적으로 opt in할 때
  사용할 neutral proposed-change container다.

## Command Assembly Convention

CLI command files are assembly and presentation surfaces. They parse arguments,
dispatch to focused handlers or library functions, print text/JSON output, and
set command exit codes. Reusable read-model construction, parsing, ranking,
readiness checks, rendering, path policy, and transformation logic belong in
internal modules under `packages/cli/src/lib/**` or focused command-handler
modules under `packages/cli/src/commands/**`.

Docs command features should follow the current split: `docs.ts` owns command
flow and output formatting, while docs-control-plane modules own adapters,
family scope, role matrix, TODO lifecycle parsing, completed-record detection,
follow-up ranking, graph traversal, drift, metadata transform previews, and PRD
compatibility transforms. Ontology pack authoring follows the same convention:
`ontology.ts` remains the router, `commands/ontology/pack-authoring.ts` owns
pack command printing/exit-code policy, and `lib/ontology-pack-*` modules own
scaffold planning, rendering, writing, loading, runtime validation, and
readiness checks.

Extracted modules from this refactor are internal CLI libraries. They may be
imported by CLI command code and focused CLI tests, but no package-level public
exports are required unless a later PRD explicitly promotes them.

For scaffold-like commands, the default mode is dry-run. A dry-run returns the
same planned file/candidate/readiness shape that write mode uses, with no file
system mutation. Write mode must require an explicit flag such as `--write`,
materialize only planned files, refuse unsafe paths or existing outputs, and
leave resolver, source-map, activation, and registry mutations as separate
manual or explicit command steps.

Readiness-oriented JSON results should keep the top-level contract stable:
`valid` is the command gate, `issues` is the flat ordered diagnostic list,
`runtime` summarizes runtime contract validation, and `readiness` summarizes
implementation/test/docs/source-map preparedness. Warning-level readiness issues
can keep `valid: true`; error-level issues make the command invalid.

Identity/data/system separation is an implementation organization guideline, not
an ECS-only architecture. Identity modules define stable ids and symbols, data
modules define read models or schema declarations, and system modules perform
explicit transformations such as parsers, renderers, validators, projectors,
readiness collectors, or writers. ECS can be modeled by ontology packs, but this
module separation applies to docs and ontology CLI code without requiring ECS
scheduling, archetypes, or storage layout.

## Adapters

- `artifact-evidence`: local programming artifact registry JSON files를 배열 또는
  `{ artifacts: [...] }` envelope로 읽어 artifact registry record를 evidence
  envelope로 수집한다. Artifact id/kind/ref/output path, produced-by,
  derived-from, verifies, owner definition, materializes-output, source refs,
  verification refs, source metadata, relation edges를 source-owned vocabulary로
  보존한다. `activation-evidence`는 기존 programming artifact kind 값 그대로
  `DocumentEvidence.kind`에 매핑하며 control-plane vocabulary를 추가하지 않는다.
  기본 registry path가 없어도 정상 docs status 흐름은 실패하지 않고, caller가
  `warnOnMissing`을 명시할 때만 missing source diagnostic을 반환한다.
- `definition-markdown`: definition-catalog의 frontmatter scanner/parser와 graph
  validation을 재사용해 `.spec.md`, `.todo.md`, `.plan.md`, `.rule.md`,
  `.cases.md`, `.test.md`, `.memo.md` 파일을 read-only envelope로 수집한다. `def.*`
  metadata, source refs, purpose/overview marker sections, links, source path,
  validation diagnostics를 source vocabulary 그대로 보존한다.
- `prd-markdown`: `[PRD]...[/PRD]` markdown block을 읽어 overview, goals,
  quality gates, user stories, acceptance criteria, functional requirements,
  non-goals, open questions를 envelope section/task metadata로 보존한다.
- `ralph-prd-json`: ralph-tui용 flat root PRD JSON을 compatibility surface로
  읽는다. Root `prd`/`tasks`/`metadata`, story `status`, non-boolean
  `passes`, missing `dependsOn` 같은 schema anti-pattern은 diagnostics로
  드러내고, `userStories[]`는 `passes`, dependencies, notes,
  completion notes, quality gates를 가진 control-plane tasks로 매핑한다.
- `ralph-session`: `.ralph-tui/session-meta.json`을 transient session envelope로
  읽을 수 있다. 연결된 PRD JSON의 story pass state와 session status/count
  drift diagnostics는 `docs drift --include-session` 또는
  `docs prd sync-completion --include-session`에서만 운영 신호로 포함한다.

## Command-layer workflows

- `docs prd context`: adapter envelope를 조합해 PRD authoring context를 만든다.
  스펙, 열린 TODO, 계획, 기존 PRD, PRD JSON completion state, ralph session
  state, scenario matrix row, source, evidence를 조회하지만 source 파일은
  변경하지 않는다.
- `docs prd scaffold`: 수집한 context로 markdown PRD skeleton만 작성한다. 이
  workflow는 `ralph-tui`를 호출하지 않고, ralph PRD JSON 생성도 수행하지 않는다.
- `docs prd to-ralph-json`: markdown PRD를 flat root ralph-compatible JSON으로
  materialize한다. PRD JSON은 ralph-tui compatibility adapter target일 뿐 core
  document model이 아니며, 작성 전 target adapter validation을 통과해야 한다.
- `docs prd sync-completion`: completed ralph PRD JSON을 읽어 TODO/spec/roadmap/
  scenario matrix 후보를 dry-run으로 계산한다. 기본값은 repo-tracked 문서/PRD
  state만 보며, `.ralph-tui` session state는 `--include-session`일 때만 포함한다.
  `passes: true`는 candidate signal이고 source/test/evidence가 없는 TODO/spec
  promotion은 blocked로 남긴다. Affected document reasons are canonical
  `target`, `role`, `composition`, `trace`, `source`, or `evidence`; transient
  session state uses `session` only when explicitly included.
- `docs transform metadata`: definition markdown frontmatter만 대상으로 dry-run
  projection을 만든다. 지원 rule은 `select|match`, `set.lifecycle`, `set.level`,
  `set.svc`, `set.sources`, `tags.add/remove`, `links.add/remove`,
  `sources.set/add/remove`이며 `def.id` 변경과 `--apply`는 거부한다.

## Out of scope

- REST endpoint 또는 remote document service
- persistent control-plane store/database migration
- adapter write path
- automatic unreviewed TODO/spec promotion
