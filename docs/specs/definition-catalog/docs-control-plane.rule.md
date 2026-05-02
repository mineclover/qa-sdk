---
def:
  tier: component
  id: docs-control-plane-rule
  type: spec
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [structural, contract, testing]
  links:
    - target: docs-control-plane
      type: traces_to
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: state-event-terminology
      type: depends_on
    - target: doc-type-convention
      type: traces_to
    - target: docs-control-plane-markdown-governance
      type: refs
---

# Docs Control Plane — 문서 바운더리 소비 규칙

## 목적 ^purpose

`qa-sdk docs` control plane에서 문서 family, TODO, PRD, source-map, graph result를 작성하거나 소비할 때 적용할 바운더리 판별 기준을 정의한다. 목표는 문서 모듈화를 임의 주제나 오래된 파일 순서가 아니라 E/C/I/S + L/P 책임 분리 원칙에 맞춰 반복 가능하게 유지하는 것이다.

## E/C/I/S + L/P Boundary Rule ^defines

Docs control plane의 문서 모듈화는 architecture-neutral한 Entry/Identity, Component, Interface/DSL, System, Layout/Pack 분리 원칙을 기준점으로 삼는다. 이는 ECS 전용 문서 구조가 아니다. ECS는 이 분리 원칙을 잘 보여주는 하나의 아키텍처일 뿐이며, docs control plane은 임의의 도메인 문서와 운영 command를 같은 방식으로 모델링할 수 있어야 한다.

| Responsibility | Docs control-plane 대응 | 문서화 규칙 |
|----------------|-------------------------|-------------|
| Entry / Identity (E) | `def.id`, `stableId`, `familyId`, source path, PRD story id, artifact id | 안정 식별자다. 상태와 행위를 넣지 않는다. |
| Component (C) | frontmatter, `DocumentEnvelope`, links, sources, tasks, evidence, role coverage, follow-up records, completed-record candidates | data-only read model이다. 숨은 mutation이나 실행 로직을 넣지 않는다. |
| Interface / DSL (I) | `qa-sdk docs` command descriptors, command usage, accepted flags, output contract | public operator surface다. graph/BDD semantics를 직접 소유하지 않는다. |
| System (S) | `docs status`, `docs graph`, `docs drift`, `docs prd context`, `docs bdd`, graph reranking/filtering/summary | Component data를 읽고 변환하는 명시적 behavior다. 원본 문서 상태를 암묵적으로 소유하지 않는다. |
| Layout / Pack (L/P) | docs family, plan/todo grouping, roadmap and inventory grouping | 조망/배치만 소유한다. behavior/data ownership을 갖지 않는다. |

## Boundary Checklist

새 문서 family나 PRD를 만들 때는 아래 순서로 판단한다.

1. **Entry / Identity** — 이 family가 소유할 stable id와 좌표가 무엇인지 먼저 정한다.
2. **Component data** — 이 family가 정의하거나 소비하는 data-only 선언, metadata, source refs, evidence refs를 분리한다.
3. **Interface / DSL** — operator가 호출하는 command/flag/output contract를 분리한다.
4. **System behavior** — 검증, 투영, 동기화, ranking, filtering, scaffold, validate 같은 변환 경계를 정한다.
5. **Layout / Pack** — roadmap, plan/todo, inventory grouping이 조망만 하는지 확인한다.
6. **Non-goal** — activation, write, archive, promotion, resolver mutation처럼 다른 system이 소유한 행위를 현재 family에 섞지 않는다.

## Authoring Rules

- 새 document family는 가능하면 System-like transform boundary를 기준으로 잡는다. 예: graph traversal, graph reranking, PRD completion sync, pack scaffold, pack validate.
- Markdown 상대경로, heading fragment, marker anchor, 임시 병합 preview는 `docs-control-plane-markdown-governance`를 따른다.
- System-like 문서는 자신이 소비하는 Component-like data와 산출하는 read model을 명시해야 한다.
- Component-like 문서는 data shape와 lifecycle만 정의하고, 검증/투영/동기화/CLI 실행 로직을 소유하지 않는다.
- Entity-like id는 문서, source-map, PRD, artifact 전반에서 stable coordinate로 유지한다.
- TODO와 PRD는 System-like boundary를 기준으로 작성한다. 단순 파일 오래됨, 검색 결과, 임의 주제 묶음은 우선순위 기준이 아니다.
- Read-only command output(`roleCoverage`, `nextFollowUps`, `completedRecords`, graph ranking/filtered views)은 후보와 projection이며, 원본 문서를 자동 변경하는 authority가 아니다.

## Code Structure Rules

Docs control plane 구현 코드는 `architecture-revealing-code-convention`을 따른다.

- `graph-types.ts`, BDD schema, work-topic schema 같은 data shape는 Component-like code다.
- `docs.commands.ts`, command descriptor, flag parser는 Interface-like code다.
- graph traversal/ranking/filtering/summary, PRD sync, BDD compile/extract는 System-like code다.
- `index.ts`, adapter registry, package facade는 Layout/Pack-like code다.
- 하나의 System behavior가 여러 파일로 구현되는 것은 정상이다. 문서는 파일 수가 아니라 독립 책임 수에 맞춰 나눈다.
- `sources`는 code topology를 보여주는 증거이며, 문서가 모든 source file을 behavior owner로 흡수한다는 뜻이 아니다.

## Deterministic Label / Readiness Consumption Rules ^consumes

Deterministic label과 readiness projection은 기존 docs-control-plane command를 대체하는 새 authority가 아니라, 같은 입력을 반복 가능하게 읽기 위한 read model이다. `docs status`, `docs graph`, `docs drift`, `docs prd sync-completion`, `def validate`, `ontology pack validate` 결과를 label/readiness evidence로 소비할 수 있지만, 이 projection이 source 문서나 registry state를 직접 소유하지 않는다.

- Label projection은 read-only다. `def.id`, `stableId`, `familyId`, source path, pack id, artifact id, PRD path, story id를 URN으로 migration하지 않고, append-only label registry persistence는 별도 persistence PRD까지 deferred 상태로 둔다.
- Readiness projection은 deterministic label record list 위의 System-like transform이다. 통과한 gate의 마지막 valid state를 계산하거나 diagnostic을 남길 수 있지만, read-only 단계는 `BLOCKED`를 persisted currentState로 설정하거나 transition event를 write하지 않는다.
- Transition dry-run을 다시 도입한다면 preview다. 요청 evidence refs는 transient evaluation copy에만 합치고, label records, definition markdown, PRD/TODO, ontology pack registry, registry-service/index-meta store를 수정하지 않는다.
- PRD markdown, ralph PRD JSON, TODO checklist는 execution/review artifact다. 이들은 transition request나 evidence를 제공할 수 있지만 activation, archive, TODO/spec promotion, deterministic label transition의 authority가 아니다.
- `passes: true`, completed checkbox, `completedRecords[]`, `nextFollowUps[]`는 review signal이다. Operator가 사용할 수 있는 evidence이지, write-mode transition approval이나 lifecycle mutation approval이 아니다.
- Future write-mode transition controller는 out of scope다. 이를 추가하려면 append-only persistence, actor/sequence/committedAt/registryRevision, rollback/visibility policy, validation commands를 명시하는 별도 PRD가 필요하다.
- ECS는 Entity-like identity / Component-like data / System-like transform 분리를 설명하는 reference model이다. Docs-control-plane은 ECS runtime, scheduling, archetype, SoA storage를 전제하지 않으며, 다른 아키텍처도 같은 boundary rule로 문서화한다.

## TODO Heading Rules

- Checkbox state는 binary다. `[ ]`는 open, `[x]`/`[X]`는 completed이다.
- 실행 상태는 checkbox marker가 아니라 heading category가 표현한다.
- Canonical heading은 `Completed — 완료 기록`, `Actionable — 실행 가능`, `Deferred — 조건부 대기`, `Parking Lot — 후보 보관`이다.
- `Actionable`은 지금 PRD화 가능한 System-like work만 둔다.
- `Deferred`는 trigger condition이나 외부 boundary가 필요한 작업을 둔다.
- `Parking Lot`은 owner, scope, 실행 조건이 아직 확정되지 않은 후보만 둔다.

## PRD And Drift Rules

- PRD markdown은 authoring/review artifact이고, ralph PRD JSON은 execution state다.
- `passes: true`는 completion candidate signal일 뿐이며 TODO/spec promotion authority가 아니다.
- 완료된 PRD JSON과 markdown PRD 체크박스는 drift 없이 동기화해야 한다.
- `.ralph-tui/session-meta.json`은 transient local session state다. 기본 drift/completion 판단에는 포함하지 않고 `--include-session`에서만 본다.
- Archive PRD, archived doc, completed record candidate는 정확한 target이나 opt-in 없이 active inventory로 승격하지 않는다.

## Topdown Lifecycle Inventory Rules

- topdown lifecycle inventory는 read-only operating pass다. active family를 읽어 `roleCoverage`, TODO heading bucket, `completedRecords[]`, source/evidence proof, drift 상태를 수집하지만 archive/promote/mutate authority는 갖지 않는다.
- active scope 기본값은 repo-owned docs와 active PRD record다: `docs/specs/**`, `tasks/**/prd-*.md`, `tasks/**/prd-*.json`.
- `tasks/archive/**`, archived lifecycle record, transient `.ralph-tui/session-meta.json`은 explicit target 또는 opt-in flag 없이는 active inventory에 넣지 않는다.
- inventory root는 stale terminal doc이 아니라 stable System/Layout root다. contained/ref 문서를 먼저 읽고, same-family role docs를 읽고, source/evidence는 마지막에 proof로 확인한다.
- `completedRecords[]`와 `nextFollowUps[]`는 review signal이다. active inventory의 우선순위를 보여주지만 write-mode lifecycle authority는 아니다.

## Completed Record Review Rules

- completed record review는 human workflow다. `docs status`, `docs collect`, `docs drift`는 후보와 evidence를 모으지만 archive/memo/spec promotion을 실행하지 않는다.
- `docs cleanup review`는 completed record candidate를 명시적으로 모아 recommendation을 보여주는 read-only review surface다. recommendation은 write authority가 아니다.
- `docs cleanup plan`은 explicit target validation과 proposed output path를 가진 dry-run planning surface다. write authority는 아니며 `--apply`는 unsupported 상태로 둔다.
- `docs cleanup apply`는 explicit write surface다. 현재는 validated archive move, completed TODO 대상 memo conversion move, completed PRD pair memo conversion move, completed TODO 대상 spec promotion move, rewrite move/in-place patch를 허용하고, output path 존재 시 거절한다.
- bounded batch cleanup은 `--all --recommended` 또는 `--all --action-map`에서만 허용한다.
- batch cleanup apply는 repo/family/PRD scope를 허용하지만 recommendation 기반 action 또는 explicit action-map만 실행한다.
- single-target cleanup은 `--override <json-file|inline-json>`로 action-map object와 같은 override shape를 직접 받을 수 있다.
- action-map batch cleanup은 completed record path, document id, paired PRD JSON path 중 하나를 key로 쓸 수 있다.
- action-map object entry는 `action` 외에 `outputPath`, `secondaryOutputPath`, `assimilationTargetPath`, `appendMarkdown`, `bodyTemplate`, `frontmatterPatch`를 가질 수 있다.
- `frontmatterPatch`는 `level`, `scope`, `aspect`, `depth`, `layer`, `lifecycle`, `svc`, `tags`, `links`만 허용한다.
- override string field는 cleanup candidate/record placeholder를 허용하지만, 지원 목록 바깥 token은 warning으로만 남기고 그대로 보존된다.
- checked-only `.todo.md`와 all-passing ralph PRD JSON paired markdown PRD는 cleanup-review candidate다. 기본 severity는 informational signal이며 validation failure가 아니다.
- completed record는 자동으로 `nextFollowUp` work로 승격되지 않는다. review 대상이지 실행 대상이 아니다.
- archive는 `docs cleanup apply --action archive` 같은 explicit write workflow에서만 허용한다.
- memo conversion은 completed TODO 대상에 한해 `docs cleanup apply --action memo-conversion`으로 허용한다. moved target에도 `bodyTemplate`/`appendMarkdown` override가 적용될 수 있다.
- completed PRD pair memo conversion은 `docs cleanup apply --action memo-conversion`으로 허용하되, markdown은 `.memo.md`로 이동하고 paired JSON은 archive로 이동한다.
- completed TODO spec promotion은 `docs cleanup apply --action promote-spec`으로 허용하되, 같은 family의 단일 spec target이 있어야 하고 TODO는 archive로 이동한다.
- rewrite는 in-place 또는 moved record target에 body/frontmatter override를 적용할 수 있고, `assimilationTargetPath`가 있으면 그 target도 append/update할 수 있다.
- supported action matrix(archive / memo-conversion / promote-spec / rewrite)를 넘는 custom semantic rewrite는 아직 별도 explicit PRD 또는 write workflow가 필요하다.
- reviewers는 family-level `docs status --json`, `docs collect --family-only --json`, PRD-scoped `docs drift --prd ... --json`을 evidence 묶음으로 사용한다.

## Write Policy Rules

- 기본 정책은 no hidden write다. read-only command output은 candidate/projection이며 source mutation authority가 아니다.
- `docs status`, `docs collect`, `docs search`, `docs drift`, `docs prd context`는 read-only다.
- `docs transform metadata`는 dry-run preview가 기본이고, source-owned markdown만 대상으로 한다.
- `docs prd sync-completion`은 dry-run only이며 candidate reason과 blocked/eligible promotion state를 계산할 뿐 TODO/spec를 직접 수정하지 않는다.
- `docs prd scaffold`와 `docs prd to-ralph-json`만 explicit output path를 가진 write surface이며, compatibility/authoring output만 materialize한다.
- write-mode command를 새로 만들 때는 explicit flag, target validation, no hidden overwrite, preserved source/evidence links를 함께 정의해야 한다.

## Graph Result Rules

- Graph traversal은 retrieval phase다. Ranking/filtering/summary는 traversal 이후 result consumption phase다.
- Raw traversal fields(`nodes`, `edges`, `paths`)는 graph truth로 보존한다.
- Ranked/filtered/summary view는 additive projection이다.
- Rule-based reranking은 operator convenience이며, LLM/vector semantic reranking이 아니다.
- `--axis`는 traversal axis 선택이고, `--filter-axis`는 post-traversal view filtering이다.
