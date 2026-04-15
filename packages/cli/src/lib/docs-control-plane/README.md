# Docs Control Plane

이 모듈은 문서형 source를 하나의 neutral envelope로 조회하기 위한 local CLI
support boundary다. Definition docs, PRD, ralph JSON, session, evidence,
diagnostic을 원본 schema 병합이나 대체 없이 표현한다.

Repository 파일이 source of truth다. Control plane은 index/coordination layer일
뿐이다. Adapter는 source 파일이나 기존 store를 읽어 `DocumentEnvelope`를 만들고,
`kind`, `status`, relation `type`, diagnostic `severity` 같은 source-owned
vocabulary를 plain string field로 보존한다.

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
- `ralph-session`: `.ralph-tui/session-meta.json`을 session envelope로 읽고,
  연결된 PRD JSON의 story pass state와 session status/count 사이의 drift를
  diagnostics로 보고한다.

## Command-layer workflows

- `docs prd context`: adapter envelope를 조합해 PRD authoring context를 만든다.
  스펙, 열린 TODO, 계획, 기존 PRD, PRD JSON completion state, ralph session
  state, scenario matrix row, source, evidence를 조회하지만 source 파일은
  변경하지 않는다.
- `docs prd scaffold`: 수집한 context로 markdown PRD skeleton만 작성한다. 이
  workflow는 `ralph-tui`를 호출하지 않고, ralph PRD JSON 생성도 수행하지 않는다.
