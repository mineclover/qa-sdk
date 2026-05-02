[PRD]
# PRD: Deterministic Label Registry FSM Read Model

## Overview

This PRD implements the first read-only layer of the deterministic label registry and FSM control plane described by `deterministic-label-registry-fsm-plan` and `deterministic-label-registry-fsm-todo`. The goal is to move below PRD/TODO convenience artifacts and model repository configuration units as deterministic label candidates with semantic coordinates, label records, FSM readiness, and transition dry-run results.

The work is deliberately read-only. It must not persist an append-only registry, mutate document lifecycle state, move files, migrate ids to URNs, or perform real transitions. It should collect current docs/pack/source/PRD/evidence state into deterministic projections and report what would be required for `DRAFT -> LINTED -> RESOLVED -> ACTIVE` readiness.

## Goals

- Define semantic coordinate candidate types for docs, sources, packs, artifacts, PRDs, and evidence.
- Define a read-only deterministic label record projection.
- Collect label candidates from existing docs-control-plane inputs.
- Compute FSM readiness for `DRAFT`, `LINTED`, `RESOLVED`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`, and `BLOCKED`.
- Provide transition dry-run result shapes without writing state.
- Document operating rules and boundaries for future label registry persistence.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and deterministic label read-model tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `node packages/cli/dist/index.js def validate` - definition graph validation

Operational checks:

- `node packages/cli/dist/index.js docs status deterministic-label-registry-fsm-plan --json`
- `node packages/cli/dist/index.js docs status deterministic-label-registry-fsm-todo --json`
- `node packages/cli/dist/index.js docs status docs-control-plane --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-completed-record-lifecycle.json --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-graph-result-ranking-filtering.json --json`

No browser verification is required.

## User Stories

### US-001: Define Semantic Coordinate Candidate Types

**Description:** As a docs-control-plane maintainer, I want a semantic coordinate candidate model so configuration units can be identified independently of physical paths.

**Acceptance Criteria:**
- [ ] Add types for semantic coordinate candidates.
- [ ] Support label kinds for definition docs, source files, ontology packs, artifacts, PRD markdown, ralph PRD JSON, PRD stories, and evidence.
- [ ] Define canonical candidate format examples for `urn:def:*`, `urn:source:*`, `urn:pack:*`, `urn:artifact:*`, and `urn:prd:*`.
- [ ] Preserve existing ids and paths; do not migrate repository ids to URNs.
- [ ] Add diagnostics for missing kind, invalid version, ambiguous physical ref, and collision candidates.
- [ ] Add unit tests for coordinate generation from representative ids.

### US-002: Map Existing IDs To Label Candidates

**Description:** As a docs operator, I want existing ids mapped into label candidates so the system can inventory current docs without requiring a migration.

**Acceptance Criteria:**
- [ ] Map `def.id`, `stableId`, `familyId`, `sourcePath`, `packId`, `artifactId`, and PRD story ids to label candidates.
- [ ] Preserve physical refs such as markdown paths, source paths, PRD paths, and artifact output paths.
- [ ] Report duplicate label candidates as diagnostics rather than overwriting.
- [ ] Exclude archive PRDs and transient `.ralph-tui` session state by default.
- [ ] Include archive/session only through existing exact target or opt-in policy where applicable.
- [ ] Add tests using mixed definition markdown, source path, pack, PRD, and evidence fixtures.

### US-003: Define Deterministic Label Record Shape

**Description:** As a maintainer, I want a read-only label record shape that can later become an append-only registry entry without changing semantics.

**Acceptance Criteria:**
- [ ] Define `DeterministicLabelRecord` or equivalent type.
- [ ] Include label, kind, currentState, physicalRefs, dependencyLabels, sourceRefs, evidenceRefs, and diagnostics.
- [ ] Keep the projection read-only and candidate-based.
- [ ] Do not introduce persistence or append-only storage in this story.
- [ ] Add tests for record construction with empty and populated dependencies/source/evidence refs.

### US-004: Project DocumentEnvelope Inputs Into Label Records

**Description:** As a docs-control-plane maintainer, I want `DocumentEnvelope` data projected into label records so definition docs and PRD artifacts can participate in deterministic readiness checks.

**Acceptance Criteria:**
- [ ] Project definition markdown envelopes into label records.
- [ ] Project PRD markdown and ralph PRD JSON envelopes into label records.
- [ ] Project document links into dependency label candidates.
- [ ] Project document sources into source label candidates.
- [ ] Project document evidence into evidence label candidates.
- [ ] Preserve completed-record and active/archive scope metadata.
- [ ] Add tests for projection from representative `DocumentEnvelope` fixtures.

### US-005: Project Ontology Pack And Artifact Inputs Into Label Records

**Description:** As an ontology maintainer, I want pack validation and artifact evidence data projected into label records so packs and evidence can join the same deterministic control plane.

**Acceptance Criteria:**
- [ ] Project known ontology pack ids into pack label records.
- [ ] Project `ontology pack validate` identity, component schema, system bindings, runtime, and readiness status into label metadata.
- [ ] Project artifact/evidence records where available into artifact/evidence label records.
- [ ] Preserve readiness warnings as diagnostics, not hard failures.
- [ ] Do not activate packs or mutate known-pack registry.
- [ ] Add tests for programming-artifact and authorization pack projection fixtures.

### US-006: Compute FSM Readiness States

**Description:** As an operator, I want deterministic readiness states computed from existing validation signals so state transitions can be reviewed before any write-mode controller exists.

**Acceptance Criteria:**
- [ ] Define FSM states `DRAFT`, `LINTED`, `RESOLVED`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`, and `BLOCKED`.
- [ ] Compute `DRAFT -> LINTED` readiness from syntax/frontmatter/schema/doc-type validation signals.
- [ ] Compute `LINTED -> RESOLVED` readiness from link/source-map/dependency/evidence resolution.
- [ ] Compute `RESOLVED -> ACTIVE` readiness from drift-free status, required evidence, role quality placeholders, and pack runtime validation where applicable.
- [ ] Represent invalid transitions as blocked diagnostics without changing current state.
- [ ] Add tests for linted, unresolved, resolved, active-ready, deprecated, archived, and blocked examples.

### US-007: Add Transition Dry-Run Result Shape

**Description:** As a future controller implementer, I want a transition dry-run result shape so transition logic can be tested before persistence is introduced.

**Acceptance Criteria:**
- [ ] Define transition request shape with target label, requested state, reason, and evidence refs.
- [ ] Define dry-run result shape with accepted/rejected, current state, next state, blockers, and gate evidence.
- [ ] Ensure dry-run results do not mutate labels, documents, PRDs, or registries.
- [ ] Include append-only transition event schema candidate as metadata or documentation.
- [ ] Add tests for accepted and rejected dry-run transitions.

### US-008: Add Read-Only Inventory API Or Internal Entry Point

**Description:** As a CLI maintainer, I want a reusable entry point for deterministic label inventory so commands and future PRDs can consume the same projection.

**Acceptance Criteria:**
- [ ] Add an internal read-only function to build deterministic label inventory from docs-control-plane inputs.
- [ ] Function accepts rootDir and existing document envelopes or builds them through existing adapters.
- [ ] Function returns label records, diagnostics, and summary counts.
- [ ] No user-facing command is required in this story unless implementation naturally needs one.
- [ ] Add tests for summary counts and deterministic ordering.

### US-009: Document Operating Boundaries

**Description:** As a future maintainer, I want docs explaining how deterministic labels, FSM readiness, and transition dry-run relate to existing docs-control-plane commands.

**Acceptance Criteria:**
- [ ] Update `deterministic-label-registry-fsm-plan` if implementation decisions refine the plan.
- [ ] Update `docs-control-plane.rule.md` or a linked rule section with deterministic label/FSM consumption rules.
- [ ] Document that PRD/TODO are execution artifacts, not transition authority.
- [ ] Document that label projection is read-only and persistence is deferred.
- [ ] Document that ECS is a separation reference model, not the only supported architecture.
- [ ] Document future write-mode transition controller as out of scope.

### US-010: Verify Deterministic Label Registry FSM Read Model Operationally

**Description:** As a reviewer, I want command evidence that the read-only deterministic label model works without hidden writes.

**Acceptance Criteria:**
- [ ] Run status checks for deterministic plan/todo and docs-control-plane.
- [ ] Run drift checks for at least two completed PRDs.
- [ ] Run `def validate`.
- [ ] Run all quality gates.
- [ ] Verify no files are moved, archived, or rewritten automatically.
- [ ] Record residual label/FSM follow-up candidates in `deterministic-label-registry-fsm-todo.md` if needed.

## Functional Requirements

- FR-1: Label registry work must be read-only in this PRD.
- FR-2: Semantic coordinate candidates must not replace existing ids.
- FR-3: Label records must preserve physical refs and source-owned identifiers.
- FR-4: FSM readiness must be deterministic for the same inputs.
- FR-5: Invalid transitions must preserve current state and report blockers.
- FR-6: PRD/TODO artifacts must be treated as transition evidence, not transition authority.
- FR-7: Archive and transient session state must remain excluded by default.
- FR-8: Pack readiness warnings must remain warnings unless a later strict policy says otherwise.
- FR-9: No append-only persistence or write-mode transition controller is allowed.
- FR-10: Existing docs-control-plane JSON outputs must remain backward-compatible.

## Non-Goals

- Persisting a label registry.
- Writing append-only transition events.
- Migrating existing ids to URNs.
- Changing definition-catalog validation semantics.
- Moving files to archive or memo.
- Activating ontology packs.
- Changing registry-service or index-meta schemas.
- Implementing ECS runtime scheduling, archetypes, or SoA storage.

## Technical Considerations

- Existing inputs:
  - `packages/cli/src/lib/docs-control-plane/types.ts`
  - `packages/cli/src/lib/docs-control-plane/index.ts`
  - `packages/cli/src/lib/docs-control-plane/completed-records.ts`
  - `packages/cli/src/lib/docs-control-plane/follow-ups.ts`
  - `packages/cli/src/lib/docs-control-plane/role-matrix.ts`
  - `packages/cli/src/lib/ontology-pack-validate.ts`
- Candidate modules:
  - `packages/cli/src/lib/docs-control-plane/deterministic-labels.ts`
  - `packages/cli/src/lib/docs-control-plane/deterministic-label-fsm.ts`
  - `packages/cli/src/lib/docs-control-plane/deterministic-label-transition.ts`
- Existing docs:
  - `docs/specs/definition-catalog/deterministic-label-registry-fsm.plan.md`
  - `docs/specs/definition-catalog/deterministic-label-registry-fsm.todo.md`
  - `docs/specs/definition-catalog/docs-control-plane.rule.md`
  - `docs/specs/definition-catalog/definition-state-model.spec.md`

## Success Metrics

- Current docs/pack/source/PRD/evidence inputs can be projected into deterministic label records.
- FSM readiness can explain why a label is or is not active-ready.
- Transition dry-run can explain accepted/rejected transitions without writes.
- Existing docs/graph/pack commands remain stable.
- The next persistence PRD has a concrete record and event shape to build on.

## Open Questions

- Should the initial label candidate use `urn:*` strings directly or a structured `{scheme, domain, kind, id, version}` object with a derived URN?
- Should transition dry-run be exposed through a user-facing command in the first implementation, or remain internal until persistence is designed?
- Which state should represent completed PRD markdown: `ACTIVE`, `ARCHIVED`, or a separate completed-record readiness flag?
[/PRD]
