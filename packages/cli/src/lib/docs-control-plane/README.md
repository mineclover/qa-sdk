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
`rule`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json`,
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

Source traversal is powered by docs control-plane adapters (`DocumentEnvelope`
sources, metadata source refs, PRD/session paths, and artifact evidence refs).
It is intentionally broader than, and distinct from, `qa-sdk def find-by-file`,
which reads DB-owned `code_references` explicit source maps only.

이 story는 REST endpoint, remote service, database migration, 새 artifact
vocabulary를 추가하지 않는다.

## Boundary

- `DocumentEnvelope`는 normalized read model이다.
- `DocumentAdapter`는 read-only collection method만 노출한다.
- `DocumentAdapterCapabilities`는 adapter의 write/transform 가능 여부만 선언한다.
  Control plane 자체는 write path를 만들지 않는다.
- `DocumentChangeSet`은 future adapter가 write/transform을 명시적으로 opt in할 때
  사용할 neutral proposed-change container다.

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
  validation을 재사용해 `.spec.md`, `.todo.md`, `.plan.md`, `.test.md`,
  `.memo.md`, `.rule.md` 파일을 read-only envelope로 수집한다. `def.*`
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
  promotion은 blocked로 남긴다.
- `docs transform metadata`: definition markdown frontmatter만 대상으로 dry-run
  projection을 만든다. 지원 rule은 `select|match`, `set.lifecycle`, `set.level`,
  `set.svc`, `set.sources`, `tags.add/remove`, `links.add/remove`,
  `sources.set/add/remove`이며 `def.id` 변경과 `--apply`는 거부한다.

## Out of scope

- REST endpoint 또는 remote document service
- persistent control-plane store/database migration
- adapter write path
- automatic unreviewed TODO/spec promotion
