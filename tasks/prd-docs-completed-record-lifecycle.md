[PRD]
# PRD: Docs Completed Record Lifecycle

## Overview

The docs control plane can now detect completed records through `completedRecords[]`: checked-only `.todo.md` files and PRD markdown files whose paired ralph PRD JSON has all stories passing. This is useful, but the lifecycle policy is still implicit. Completed records are currently read-model candidates, not file moves, not archive operations, and not spec/todo promotion authority.

This PRD formalizes completed record lifecycle semantics. It keeps the workflow read-only and conservative: completed records are detected and surfaced clearly, `docs drift` can report relevant lifecycle warnings or info, but no files are moved to archive or converted to `.memo.md`. The goal is to make completed records understandable and actionable without creating hidden writes.

## Goals

- Clarify what `completedRecords[]` means and what it does not mean.
- Improve completed record detection and reporting across `docs status`, `docs collect`, and `docs drift`.
- Keep completed records out of active follow-up work.
- Ensure completed PRD markdown and completed TODO records do not create default workflow noise.
- Document conservative lifecycle policy for completed records.
- Preserve explicit human review before archive/memo conversion.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and lifecycle regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `node packages/cli/dist/index.js def validate` - definition graph validation

Operational checks:

- `node packages/cli/dist/index.js docs status docs-control-plane --json`
- `node packages/cli/dist/index.js docs status programming-artifact-ontology-system --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-topdown-lifecycle-inventory-alignment.json --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-graph-result-ranking-filtering.json --json`
- `node packages/cli/dist/index.js docs collect docs-control-plane --family-only --json`

No browser verification is required.

## User Stories

### US-001: Define Completed Record Lifecycle Policy

**Description:** As a docs maintainer, I want completed record lifecycle semantics documented so completed records are not confused with active work or automatic archive operations.

**Acceptance Criteria:**
- [ ] Define completed records as read-only lifecycle candidates.
- [ ] Document that completed records are not automatically moved, archived, or converted to memo.
- [ ] Document that completed records are not active follow-up work.
- [ ] Document that `passes: true` in PRD JSON is a completion signal, not promotion authority.
- [ ] Document that archive/memo conversion requires a separate explicit PRD or command.
- [ ] Update `docs-control-plane.spec.md` or `docs-control-plane.rule.md` with this policy.
- [ ] Do not change runtime behavior in this story.

### US-002: Improve Completed TODO Detection

**Description:** As a documentation operator, I want checked-only `.todo.md` files to be identified as completed records with enough metadata to decide whether to archive, memo, or keep them.

**Acceptance Criteria:**
- [ ] Completed TODO detection still requires zero open checkboxes and at least one checked checkbox.
- [ ] Completed TODO record includes path, document id, completed count, open count, and reason.
- [ ] Completed TODO record includes lifecycle and title metadata where available.
- [ ] Completed TODO record does not appear in `nextFollowUps`.
- [ ] Tests cover checked-only TODO, mixed TODO, and empty TODO cases.
- [ ] Existing `docs status` JSON shape remains backward compatible.

### US-003: Improve Completed PRD Markdown Detection

**Description:** As a planner, I want PRD markdown paired with all-passing PRD JSON to be identified as a completed record without being treated as active planning work.

**Acceptance Criteria:**
- [ ] Completed PRD markdown detection still requires a paired ralph PRD JSON with all stories passing.
- [ ] Completed PRD record includes PRD markdown path and paired JSON path.
- [ ] Completed PRD record includes story count and passed story count where available.
- [ ] Completed PRD markdown does not appear as active follow-up work.
- [ ] Tests cover paired complete JSON, paired incomplete JSON, and missing JSON.
- [ ] Existing PRD JSON adapter behavior remains unchanged.

### US-004: Add Completed Record Drift Reporting

**Description:** As a docs operator, I want `docs drift` to report completed record lifecycle candidates without treating them as errors.

**Acceptance Criteria:**
- [ ] `docs drift` can report completed record candidates as info or warning according to a documented policy.
- [ ] Completed record drift output does not fail the command.
- [ ] Completed record reporting is scoped by `--prd` when a PRD is provided.
- [ ] Completed record reporting excludes archive PRDs by default.
- [ ] Completed record reporting excludes transient `.ralph-tui` session state by default.
- [ ] Tests cover completed TODO and completed PRD markdown drift reporting.
- [ ] Existing drift error/warning behavior remains unchanged.

### US-005: Keep Completed Records Out Of Active Inventory

**Description:** As a docs control-plane user, I want completed records visible but not promoted into active next work so status and collect outputs stay focused.

**Acceptance Criteria:**
- [ ] `docs status <target> --json` includes `completedRecords[]` where applicable.
- [ ] `docs status <target> --json` excludes completed records from `nextFollowUps[]`.
- [ ] `docs collect <target> --family-only --json` includes completed record data without making it active follow-up work.
- [ ] Completed records do not affect `nextFollowUp` priority.
- [ ] Tests verify completed records are visible and non-actionable.
- [ ] Text output stays concise and labels completed records as completed records.

### US-006: Document Completed Record Review Workflow

**Description:** As a maintainer, I want a clear manual workflow for reviewing completed records so future archive/memo conversion can be done intentionally.

**Acceptance Criteria:**
- [ ] Document a manual review workflow for completed records.
- [ ] Workflow includes inspect, verify, decide keep/archive/memo, and commit steps.
- [ ] Workflow references `docs status`, `docs collect --family-only`, and `docs drift`.
- [ ] Workflow explains when to leave a completed TODO in place.
- [ ] Workflow explains when to create a future archive/memo conversion PRD.
- [ ] No automatic archive/memo command is introduced.

### US-007: Verify Completed Record Lifecycle Operationally

**Description:** As a reviewer, I want command evidence proving completed record lifecycle reporting works without hidden writes.

**Acceptance Criteria:**
- [ ] Run `docs status docs-control-plane --json` and inspect `completedRecords`.
- [ ] Run `docs collect docs-control-plane --family-only --json` and inspect completed record behavior.
- [ ] Run `docs drift --prd tasks/prd-docs-topdown-lifecycle-inventory-alignment.json --json`.
- [ ] Run `docs drift --prd tasks/prd-docs-graph-result-ranking-filtering.json --json`.
- [ ] Run all quality gates.
- [ ] Verify no files are moved, archived, or converted automatically.
- [ ] Record residual completed-record cleanup candidates in docs-control-plane TODO if needed.

## Functional Requirements

- FR-1: Completed record lifecycle must be read-only.
- FR-2: Completed records must not become active follow-up work.
- FR-3: Completed TODO detection must require zero open checkboxes and at least one completed checkbox.
- FR-4: Completed PRD markdown detection must require a paired all-passing PRD JSON.
- FR-5: `docs drift` completed-record reporting must not be an error.
- FR-6: Archive and memo conversion must remain out of scope.
- FR-7: Completed records must be scoped by active inventory rules.
- FR-8: Transient session state must remain opt-in through `--include-session`.
- FR-9: Existing `docs status`, `docs collect`, and `docs drift` JSON fields must remain backward-compatible.
- FR-10: No hidden writes are allowed.

## Non-Goals

- Automatically moving files to `tasks/archive`.
- Automatically converting `.todo.md` to `.memo.md`.
- Automatically checking or unchecking TODO items.
- Promoting TODO content into spec.
- Changing ralph PRD JSON schema.
- Changing definition-catalog validation semantics.
- Adding a write-mode lifecycle command.

## Technical Considerations

- Existing modules:
  - `packages/cli/src/lib/docs-control-plane/completed-records.ts`
  - `packages/cli/src/lib/docs-control-plane/follow-ups.ts`
  - `packages/cli/src/lib/docs-control-plane/drift.ts`
  - `packages/cli/src/commands/docs.ts`
- Existing docs:
  - `docs/specs/definition-catalog/docs-control-plane.spec.md`
  - `docs/specs/definition-catalog/docs-control-plane.rule.md`
  - `docs/specs/definition-catalog/docs-control-plane.todo.md`
- Keep completed record lifecycle aligned with the broader rule:
  - read-only command outputs are candidates/projections, not source-of-truth mutations.

## Success Metrics

- Completed records are easy to identify.
- Completed records do not appear as active next work.
- `docs drift` can surface completed record lifecycle candidates without false failures.
- No hidden writes are introduced.
- Existing docs and graph commands remain stable.

## Open Questions

- Should completed record drift reporting be `info` by default or `warning`?
- Should completed records be shown by default in text output or only in JSON?
- Should future archive/memo conversion be one command or separate PRDs per family?
[/PRD]
