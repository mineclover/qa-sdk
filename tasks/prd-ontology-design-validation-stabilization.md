[PRD]
# PRD: Ontology Design & Validation Stabilization

## Overview

qa-sdk의 ontology 설계와 검증 흐름을 안정화한다. 현재 `operational-ontology`는 allocation model이 local pure-function 단계까지 완료되어 있고, 다음 단계는 registry-service/index-meta lifecycle로 확장될 수 있다. 동시에 `definition-catalog` 문서 graph, level, contains/link/lifecycle 검증이 ontology 설계의 시작점이므로, 이번 PRD는 allocation lifecycle을 바로 DB 구현으로 밀기 전에 local validation contract와 문서/테스트 기준을 먼저 고정한다.

이 PRD는 “운영 persistence 구현”이 아니라 “설계 계약과 검증 gate 안정화”가 목표다. registry-service DB, index-meta sync, scoped prefix 정책은 전체 계획에 포함하지만, 첫 실행 단위는 local allocation invariant, definition graph validation, targeted fixture matrix를 먼저 닫는다. 그래야 후속 persistence/index-meta PRD가 흔들리지 않는 경계 위에서 시작할 수 있다.

## Goals

- ontology 설계 변경이 문서 graph validation, allocation validation, targeted tests를 통해 일관되게 검증되게 한다.
- `operational-ontology-registry-allocation.todo.md`의 큰 작업을 ralph-tui가 실행 가능한 작은 user story로 분해한다.
- registry-service/index-meta 연동은 전체 계획에 포함하되, 첫 실행 단위는 local validation과 contract 안정화로 제한한다.
- 새 axis/prefix/relation 변경이 5Q checklist, contains link, source trace, validation gate를 빠뜨리지 않게 한다.
- `def validate`와 operational-ontology package gates가 ontology 설계 안정화의 기본 완료 조건이 되게 한다.

## Execution Principles

- Start with local validation before persistence. DB tables and index-meta sync must consume stable allocation contracts, not define them implicitly.
- Keep design validation, documentation graph validation, and allocation validation separate but composable.
- Treat registry-service/index-meta work as handoff contracts until the local validation layer is explicit.
- Preserve existing TODO intent. Reorganizing TODO items is allowed; silently deleting scope is not.
- Avoid new axes, relation kinds, prefix schema changes, or scoped prefix changes without a separate decision path.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter operational-ontology test` - Operational ontology behavior tests
- `pnpm --filter operational-ontology typecheck` - Operational ontology type checking
- `pnpm --filter operational-ontology build` - Operational ontology build
- `node packages/cli/dist/index.js def validate` - Definition-catalog graph/frontmatter validation

When a story changes CLI behavior or CLI validation commands, also run:

- `pnpm --filter @qa-sdk/cli typecheck`
- Targeted CLI test matching the changed command or fixture

When a story changes registry-service or index-meta code, also run the relevant package gate:

- `pnpm --filter registry-service test`
- `pnpm --filter index-meta test`

No browser verification is required for this PRD.

## User Stories

### US-001: Consolidate Ontology Validation Scope

**Description:** As an ontology maintainer, I want a clear validation scope map so that agents know which documents, packages, and gates must be checked before changing ontology design.

**Acceptance Criteria:**
- [x] Add or update a spec/guide section that names the validation boundary for ontology design changes.
- [x] The boundary distinguishes definition-catalog validation, operational-ontology allocation validation, programming-artifact simulation validation, and registry-service/index-meta lifecycle validation.
- [x] The boundary states that registry-service/index-meta implementation is not required for local validation stories.
- [x] Relevant docs include `sources` pointing to implementation/test files where applicable.
- [x] `node packages/cli/dist/index.js def validate` passes.

### US-002: Define Allocation Validation Contract

**Description:** As an ontology maintainer, I want allocation validation requirements written as a contract so that future registry persistence work preserves the current local allocation invariants.

**Acceptance Criteria:**
- [x] Document the current `allocateOntologyAddressSpace()` and `validateOntologyAddressAllocationPlan()` invariants.
- [x] Cover duplicate prefix/version allocation, missing taxonomy axis, product allocation, and sum segment allocation.
- [x] State which invariants belong to `operational-ontology` and which are deferred to registry-service persistence.
- [x] Link the contract to `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`.
- [x] Existing allocation tests remain the executable source of truth.

### US-003: Add Validation Matrix for Ontology Design Changes

**Description:** As an ontology maintainer, I want a scenario matrix for ontology design changes so that each kind of change has a known validation path.

**Acceptance Criteria:**
- [x] Add a matrix covering axis changes, taxonomy changes, relation/category changes, allocation policy changes, definition graph changes, and pack activation changes.
- [x] Each matrix row lists required docs, code owners, tests, and commands.
- [x] Core gate changes require impact analysis or escalation guidance rather than silent local edits.
- [x] The matrix references the 5Q checklist for new axes.
- [x] The matrix explicitly separates local validation from registry-service/index-meta activation.

### US-004: Reorganize Registry Allocation TODO into Executable Phases

**Description:** As a ralph-tui planner, I want the large registry allocation TODO split into execution phases so that each phase can become a small agent task.

**Acceptance Criteria:**
- [x] Group open TODO items into persistence schema, store adapter, service layer, index-meta sync, activation smoke, and prefix policy phases.
- [x] Each phase has a short goal, non-goals, prerequisites, and validation commands.
- [x] Cross-phase dependencies are explicit.
- [x] Phase 2 persistence tasks do not depend on implementing Phase 4 index-meta sync.
- [x] The original TODO intent is preserved; no open item is silently removed.

### US-005: Stabilize Definition Graph Requirements for Ontology Modules

**Description:** As a documentation maintainer, I want ontology module docs to have explicit graph requirements so that contains/link drift is caught before implementation starts.

**Acceptance Criteria:**
- [x] Define required frontmatter fields for ontology module, leaf, plan, todo, and knowledge docs.
- [x] Define when module docs must include `contains` links.
- [x] Define when leaf docs should split before exceeding 150 lines.
- [x] Document how `sources` should point from specs to implementation and tests.
- [x] `def validate` reports no warnings after the documentation updates.

### US-006: Add Local Validation Fixture for Allocation Drift

**Description:** As an ontology implementer, I want a targeted local fixture for allocation drift so that invalid allocation plans fail before registry persistence exists.

**Acceptance Criteria:**
- [x] Add or extend an operational-ontology test fixture for allocation drift.
- [x] The fixture covers at least one prefix/version collision.
- [x] The fixture covers at least one taxonomy-axis mismatch.
- [x] The fixture returns structured validation errors that identify the offending prefix, taxonomy, or axis.
- [x] The fixture does not require registry-service or index-meta.

### US-007: Specify Registry-Service Persistence Handoff

**Description:** As a future registry-service implementer, I want a handoff spec for ontology persistence so that DB schema work starts from stable local contracts.

**Acceptance Criteria:**
- [x] Define the persistence records expected for namespace, axis, taxonomy, allocation, and allocation segment.
- [x] Map each persistence record back to local allocation model fields.
- [x] State duplicate/collision rules that must be enforced at store or service level.
- [x] Identify which tests should be added under `registry-service` when persistence begins.
- [x] Keep actual DB schema implementation out of this story unless explicitly selected in a follow-up PRD.

### US-008: Specify Index-Meta Sync Handoff

**Description:** As a future index-meta implementer, I want a sync handoff spec so that active ontology allocations can later materialize into prefix registry and schema version records.

**Acceptance Criteria:**
- [x] Define what data active allocation must send to index-meta.
- [x] Distinguish product allocation, sum allocation, and segment materialization.
- [x] State idempotency and collision expectations for sync.
- [x] Define minimum activation smoke checks.
- [x] Keep actual index-meta sync implementation out of this story unless explicitly selected in a follow-up PRD.

### US-009: Define Catalog Scoped Prefix Decision Criteria

**Description:** As an ontology architect, I want scoped prefix decision criteria so that prefix namespace changes are not made before there is a concrete need.

**Acceptance Criteria:**
- [x] Write decision criteria for retaining global prefix uniqueness versus introducing scoped prefixes.
- [x] Include scenarios involving catalog id, ontology id, tenant boundary, and pack collisions.
- [x] List affected surfaces: `/prefixes/:prefix`, index-meta key shape, decode-service/cache keys, and migration plan.
- [x] State that registry-service prefix table schema must not change until this decision is resolved.
- [x] If a new decision doc is created, it links back to the registry allocation TODO.

## Functional Requirements

- FR-1: The stabilization plan must preserve the current local allocation model as the first executable layer.
- FR-2: The plan must define validation gates before persistence or index-meta activation implementation.
- FR-3: The plan must keep definition-catalog validation as a required gate for ontology design changes.
- FR-4: The plan must provide ralph-tui-sized user stories that can be executed independently.
- FR-5: The plan must identify registry-service and index-meta work as later phases with explicit handoff contracts.
- FR-6: The plan must not introduce new ontology axes, relation kinds, or prefix schema changes without a separate decision path.
- FR-7: The plan must preserve all existing TODO intent and make dependencies more explicit.

## Non-Goals

- Implement registry-service DB tables in the first local validation stories.
- Implement index-meta sync in the first local validation stories.
- Change global prefix uniqueness policy immediately.
- Add new artifact kind, relation kind, or ontology axis.
- Replace existing allocation tests with documentation-only checks.
- Build UI/browser workflows.

## Technical Considerations

- Primary docs:
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation.spec.md`
  - `docs/specs/definition-catalog/definition-management.spec.md`
- Primary implementation references:
  - `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
  - `packages/operational-ontology/src/allocation.ts`
  - `packages/operational-ontology/src/allocation.test.ts`
- Definition validation is mediated through `node packages/cli/dist/index.js def validate`.
- If a story touches generated CLI dist behavior, build the CLI before running `def validate`.

## Success Metrics

- Ontology design changes have a documented validation matrix.
- Registry allocation TODO is phaseable into independent ralph-tui tasks.
- Local allocation invariants are documented and tested before DB work starts.
- `def validate` passes with zero warnings after doc changes.
- Future persistence/index-meta stories can cite stable handoff contracts instead of rediscovering boundaries.

## Open Questions

- Should persistence schema implementation be split into a separate PRD immediately after US-007?
- Should `def validate` be extended with allocation-aware checks, or should allocation checks remain in operational-ontology tests?
- Should ontology validation get a dedicated CLI command that composes `def validate` and allocation tests?
- Should programming-artifact context simulation become part of the same validation gate or remain a separate targeted fixture suite?
[/PRD]
