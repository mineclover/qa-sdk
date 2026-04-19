---
def:
  id: deterministic-label-registry-fsm-plan
  type: knowledge
  knowledge_kind: proposal
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, contract, observability]
  links:
    - target: docs-control-plane
      type: refines
    - target: docs-control-plane-rule
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
    - target: definition-state-model
      type: depends_on
    - target: definition-harness
      type: depends_on
    - target: registry-system
      type: depends_on
    - target: index-meta-system
      type: depends_on
    - target: deterministic-label-registry-fsm-todo
      type: traces_to
---

# Deterministic Label Registry And FSM — 방향 계획

## 목적 ^purpose

문서, pack, source, PRD, evidence 같은 형상 단위를 semantic coordinate로 식별하고, append-only label registry와 FSM 전이 규칙으로 결정론적 제어를 달성하기 위한 방향 계획을 정의한다. 목표는 PRD/TODO 같은 실행 artifact보다 낮은 계층의 형상 관리 control plane을 먼저 고정해, 같은 입력과 같은 상태에서 항상 같은 lint/resolve/active 판단이 나오게 만드는 것이다.

## 현재 판단

현재 `qa-sdk docs`와 `qa-sdk def`는 이미 다음 기능을 제공한다.

- definition graph validation: `qa-sdk def validate`
- docs read model: `docs status`, `docs collect`, `docs graph`
- PRD drift/readiness: `docs drift`, `docs prd sync-completion`
- source-map and code boundary lookup: `def find-by-file`, `docs graph <source> --axis source`
- pack authoring and validation: `ontology pack scaffold`, `ontology pack validate`
- completed-record and follow-up candidates: `completedRecords[]`, `nextFollowUps[]`

하지만 이들은 아직 하나의 deterministic label registry/FSM control plane으로 닫혀 있지 않다. 여러 read-model은 존재하지만, 모든 형상 단위가 공통 semantic coordinate와 공통 state transition rule을 공유하지는 않는다.

US-001~US-008 구현은 이 계획의 1차 범위를 read-only internal API로 고정했다. `buildDeterministicLabelInventory()`가 docs-control-plane adapters, completed-record detection, ontology pack projection, optional FSM readiness, summary counts를 한 번에 조립하고, command layer는 아직 새 `docs label *` surface를 갖지 않는다. 따라서 현재 operator surface는 기존 `docs status`, `docs graph`, `docs drift`, `docs prd *`, `def validate`, `ontology pack validate`이고, deterministic label/FSM은 이 surface들이 소비할 수 있는 공통 read model이다.

## 목표 아키텍처

```text
Layer 0: Semantic Coordinate
  모든 형상 단위의 URN-like stable id

Layer 1: Label Registry
  coordinate -> metadata / dependencies / source refs / evidence refs / state

Layer 2: FSM State Model
  DRAFT -> LINTED -> RESOLVED -> ACTIVE
  + DEPRECATED / ARCHIVED / BLOCKED 같은 terminal 또는 exceptional states

Layer 3: Transition Controller
  lint / resolve / activate / archive 전이를 dry-run으로만 평가
  explicit write workflow는 별도 persistence/controller PRD까지 out of scope

Layer 4: Operator Views
  docs status / graph / reranking / completedRecords / PRD context

Layer 5: Execution Artifacts
  PRD markdown / ralph JSON / TODO checklist
```

이 계층에서 PRD/TODO는 상태 전이의 원천이 아니다. PRD markdown, ralph JSON, TODO checklist는 execution/review artifact이며 transition request 또는 transition evidence로만 취급한다. 최종 authority는 semantic coordinate, label registry, FSM transition controller가 가져야 한다.

## Entity / Component / System 적용

이 작업은 docs-control-plane rule의 architecture-neutral Entity / Component / System-informed boundary 원칙을 적용한다.

| Separation role | deterministic control plane 대응 |
|-----------------|-----------------------------------|
| Entity-like identity | semantic coordinate / URN-like label id |
| Component-like data | label metadata, dependency refs, source refs, evidence refs, lifecycle state |
| System-like transform | lint resolver, dependency resolver, state transition controller, registry append evaluator |

ECS는 이 분리 원칙을 보여주는 reference model일 뿐이다. 이 계획은 ECS 전용 runtime, scheduling, archetype, SoA storage를 구현하지 않는다.

## Semantic Coordinate 방향

1차 coordinate는 현재 repository에서 이미 쓰는 id를 보존하면서 URN-like canonical label 후보를 만든다.

예시:

| 형상 단위 | 현재 id | label candidate |
|----------|---------|-----------------|
| definition spec | `docs-control-plane` | `urn:def:spec:docs-control-plane:v1` |
| todo doc | `docs-control-plane-todo` | `urn:def:todo:docs-control-plane:v1` |
| source file | `packages/cli/src/commands/docs.ts` | `urn:source:typescript:packages/cli/src/commands/docs.ts` |
| ontology pack | `programming-artifact-ontology` | `urn:pack:ontology:programming-artifact-ontology:v1` |
| PRD story | `US-001` in PRD | `urn:prd:story:<prd-id>:US-001` |
| evidence artifact | activation evidence id | `urn:artifact:activation-evidence:<pack-id>:<version>` |

1차 PRD는 coordinate format을 강제 migration하지 않는다. 기존 id를 읽어 canonical label candidate를 계산하고, collision/ambiguity/gap을 보고한다.

## Label Registry 방향

Label Registry는 append-only 원장이어야 한다. 1차 구현은 write 없이 read-only candidate registry를 만든다.

Label record 후보:

```ts
interface DeterministicLabelRecord {
  label: string;
  kind:
    | "definition-doc"
    | "source-file"
    | "ontology-pack"
    | "artifact"
    | "prd-markdown"
    | "ralph-prd-json"
    | "prd-story"
    | "evidence";
  currentState:
    | "DRAFT"
    | "LINTED"
    | "RESOLVED"
    | "ACTIVE"
    | "DEPRECATED"
    | "ARCHIVED"
    | "BLOCKED";
  physicalRefs: SemanticPhysicalRef[];
  dependencyLabels: string[];
  sourceRefs: string[];
  evidenceRefs: string[];
  diagnostics: Diagnostic[];
  candidate: SemanticCoordinateCandidate;
  metadata: Record<string, unknown>;
}
```

현재 `definition-catalog` DB, docs adapters, artifact registry, known pack resolver, registry-service/index-meta stores는 label 후보의 입력 source다. 1차 PRD는 이들을 하나로 복사하지 않고, read-only projection으로 조립한다. Label projection은 `def.id`, `stableId`, source path, pack id, artifact id, PRD story id를 재작성하지 않으며, append-only label registry persistence는 Phase 4 이후 별도 판단으로 남긴다.

## FSM 방향

1차 상태 정의:

| state | 의미 | 참조 가능성 |
|-------|------|-------------|
| `DRAFT` | 작성 중, 좌표 후보만 있음 | 다른 ACTIVE 형상이 의존하면 안 됨 |
| `LINTED` | syntax/frontmatter/schema/shape 검증 통과 | 제한적 내부 참조 가능 |
| `RESOLVED` | dependency/source/evidence refs가 모두 해소됨 | activation candidate |
| `ACTIVE` | 참조 가능한 안정 상태 | 안전한 외부 참조 가능 |
| `DEPRECATED` | 대체가 존재하거나 더 이상 신규 참조 금지 | 기존 참조 추적만 |
| `ARCHIVED` | active inventory에서 제외되는 historical record | 명시 target에서만 조회 |
| `BLOCKED` | 전이 요청이 gate를 통과하지 못함 | 참조 불가 |

전이 방향:

```text
DRAFT -> LINTED -> RESOLVED -> ACTIVE
ACTIVE -> DEPRECATED -> ARCHIVED
any -> BLOCKED (controller-owned state로 예약, read-only readiness는 diagnostic만 추가)
```

허용되지 않은 전이는 현재 상태를 유지해야 한다. 예를 들어 dependency가 unresolved이면 `RESOLVED`로 전이하지 않는다. Read-only readiness 구현은 실패한 gate를 `deterministic-label-readiness-blocked` diagnostic으로 남기고 마지막 valid state를 유지한다. `BLOCKED` currentState persistence는 future write-mode transition controller가 소유한다.

## Transition Controller 방향

1차 controller는 dry-run만 한다. 현재 구현은 `dryRunDeterministicLabelTransition()` internal API로 transition request를 평가하고, 요청 evidence refs를 transient record copy에만 합친다. Label record, definition markdown, PRD/TODO, ontology pack registry, append-only registry는 수정하지 않는다.

미래 command 후보:

```bash
qa-sdk docs label inventory --json
qa-sdk docs label status <label-or-doc-id> --json
qa-sdk docs label transition <label-or-doc-id> <state> --dry-run --json
```

단, 실제 command 이름은 구현 PRD에서 확정한다. 이 plan은 command surface를 확정하지 않고 방향만 정의한다. Future write-mode transition controller는 actor/sequence/committedAt/registryRevision 같은 persistence-owned field와 append-only write authority를 별도 PRD에서 정의해야 하며, 현재 read-model PRD의 범위가 아니다.

Controller gate 후보:

| transition | gate |
|------------|------|
| `DRAFT -> LINTED` | frontmatter/schema/markdown/JSON syntax, doc type convention |
| `LINTED -> RESOLVED` | links/source-map/dependency/evidence labels resolve |
| `RESOLVED -> ACTIVE` | role quality, pack/runtime validation, drift-free, required evidence present |
| `ACTIVE -> DEPRECATED` | replacement/supersedes/owner decision exists |
| `DEPRECATED -> ARCHIVED` | completed record/archive policy and discoverability evidence exist |

## 단계

### Phase 1: Read-only label model

상태: implemented as read-only internal model.

- semantic coordinate candidate type 정의
- label record projection type 정의
- active source adapters 결정
- docs/pack/source/PRD/evidence label 후보 수집
- collision/ambiguity/gap diagnostics

### Phase 2: FSM readiness calculation

상태: implemented as read-only readiness projection.

- DRAFT/LINTED/RESOLVED/ACTIVE readiness rules
- existing `def validate`, `docs drift`, `docs graph`, `pack validate` 결과를 gate input으로 연결
- transition dry-run result shape

### Phase 3: Transition controller dry-run

상태: implemented (internal API, command surface deferred).

- `DeterministicLabelTransitionRequest` / `DeterministicLabelTransitionDryRunResult` 구현 완료
- `dryRunDeterministicLabelTransition()` internal API 구현 완료
- `DETERMINISTIC_LABEL_TRANSITION_EVENT_SCHEMA_CANDIDATE` append-only schema candidate 정의 완료
- command 후보(`docs label transition`)는 미구현, future command surface로 유지
- no hidden writes: `dryRun: true, readOnly: true, writes: false, mutationTargets: { labels: false, documents: false, prds: false, registries: false }` 명시
- append-only event schema 후보: `schemaId: "deterministic-label-transition-event", version: "candidate-v1"`, deferred fields `[actor, sequence, committedAt, registryRevision]`

### Phase 4: Registry persistence decision

상태: deferred.

- append-only label registry 저장소 필요 여부 판단
- registry-service/index-meta와의 boundary 결정
- write mode는 별도 PRD에서만 진행

## 비목표

- 1차 작업에서 실제 append-only registry persistence를 구현하지 않는다.
- future write-mode transition controller를 구현하지 않는다.
- 문서/PRD/TODO/archive를 자동으로 이동하거나 변경하지 않는다.
- 기존 `def.id`와 file path를 즉시 URN으로 migration하지 않는다.
- ECS runtime, scheduling, archetypes, SoA storage를 구현하지 않는다.
- registry-service/index-meta schema를 변경하지 않는다.

## 다음 PRD 후보

1. ~~`prd-deterministic-label-registry-fsm-read-model`~~ — 완료, archive. 구현은 `packages/deterministic-label-registry/`.
2. ~~`prd-deterministic-label-stability`~~ — 완료, archive. US-004 취소 (snapshot 기록 과다), 나머지 7개 완결.
3. ~~`prd-deterministic-label-registry-fsm-transition-dry-run`~~ — **드롭됨 (2026-04-18)**. `dryRunDeterministicLabelTransition()` internal API는 이미 존재하고 `deterministic-label-registry` 내부에 격리됨. operator CLI surface 추가 요구가 실제로 제기될 때 별도 PRD로 재개. write-mode transition controller는 **구상 자체 제거**.
4. ~~`prd-deterministic-label-registry-persistence-decision`~~ — **무기한 보류 (2026-04-18)**. append-only 영속화는 "라벨을 axis entry로 승격" 설계 결정과 얽혀 있으나 현 시점 실제 use case 없음. 필요성 데이터(persistence가 해결하는 구체적 운영 문제)가 확보되면 plan부터 재개.

## 현재 경계 (2026-04-18)

deterministic label은 **read-only inventory + diagnostic** 계층에서 완결. 다음 확장은 실제 소비자 요구가 나올 때까지 대기:
- operator-facing CLI surface
- axis entry 승격
- persistence/registry store
- write-mode controller
- snapshot 기반 regression gate

기록 근거는 `deterministic-label-stability-boundary.memo.md`.
