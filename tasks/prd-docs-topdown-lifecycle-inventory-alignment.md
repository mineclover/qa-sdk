[PRD]
# PRD: Docs Topdown Lifecycle Inventory And Alignment

## Overview

This PRD prepares a topdown lifecycle alignment pass for the qa-sdk document system. The goal is to make `qa-sdk docs` reliable enough for repository-wide spec/plan/todo/rule/cases/test/memo alignment by removing known command noise first, then inventorying active document families from system/module entry points.

The first phase focuses on noise discovered during real command use:

- `docs collect ... --graph --preset family` can become too broad for inventory work.
- TODO follow-up output lacks parent/depth information for nested checklist items.
- `docs prd scaffold` displays repo-external output paths as awkward relative paths.

After those are stabilized, the PRD builds a topdown role matrix for active families and applies the alignment to the core families: `docs-control-plane`, `operational-ontology-registry-allocation`, `programming-artifact-ontology-system`, and `authorization-ontology-system`.

## Goals

- Resolve command noise before starting broad document alignment.
- Add a narrower family-only scope for inventory-oriented docs commands.
- Preserve markdown checkbox semantics while using headings to classify TODO state.
- Expose TODO hierarchy enough to distinguish parent work items from child checklist items.
- Create a topdown inventory of active system/module families and role documents.
- Align core family TODO/plan/rule/cases state conservatively.
- Keep archive PRDs and transient `.ralph-tui` session state out of default active inventory.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and CLI regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `node packages/cli/dist/index.js def validate` - definition graph and source-map validation

These operational checks must be run for affected stories:

- `node packages/cli/dist/index.js docs status docs-control-plane --json`
- `node packages/cli/dist/index.js docs status operational-ontology-registry-allocation --json`
- `node packages/cli/dist/index.js docs status programming-artifact-ontology-system --json`
- `node packages/cli/dist/index.js docs status authorization-ontology-system --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-document-coordinate-graph-traversal.json --json`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-document-source-map-coverage-expansion.json --json`

No browser verification is required.

## User Stories

### US-001: Add Family-Only Scope For Inventory Commands

**Description:** As a docs operator, I want a narrow family-only mode so that inventory commands do not pull broad graph neighbors when I only need the active document family.

**Acceptance Criteria:**
- [ ] Add a `--family-only` option to the docs command surface where it is relevant for `status`, `collect`, `prd context`, or `prd sync-completion`.
- [ ] Family-only mode includes same-family role documents and directly contained module/leaf docs when the target is a module.
- [ ] Family-only mode excludes archive PRDs by default.
- [ ] Family-only mode excludes transient `.ralph-tui` session state unless `--include-session` is also provided.
- [ ] `docs collect programming-artifact-ontology-system --graph --preset family --family-only --json` returns a bounded inventory-oriented scope.
- [ ] Existing broad graph traversal remains available without `--family-only`.

### US-002: Expose TODO Hierarchy In Follow-Up Candidates

**Description:** As a maintainer, I want TODO follow-up candidates to preserve parent/child context so that parent work items and child checklist items are not indistinguishable.

**Acceptance Criteria:**
- [ ] `docs status ... --json` exposes `nextFollowUps[].pointer`.
- [ ] `docs status ... --json` exposes a stable hierarchy field such as `depth`, `parentTitle`, or `headingPath`.
- [ ] Parent checklist items and nested child checklist items can be distinguished in JSON output.
- [ ] Text status output remains concise and does not dump every child item by default.
- [ ] Tests cover a TODO document with parent and child checklist items under an `Actionable` heading.

### US-003: Improve Repo-External PRD Scaffold Output Paths

**Description:** As a planner, I want PRD scaffold output paths outside the repository to display clearly so that smoke tests and temporary output paths are not confusing.

**Acceptance Criteria:**
- [ ] `docs prd scaffold --output <repo-relative-path>` continues to report a repository-relative path.
- [ ] `docs prd scaffold --output <absolute-path-outside-repo>` reports an absolute path rather than a `../../..` relative path.
- [ ] JSON output and text output use the same path normalization rule.
- [ ] Existing write behavior remains unchanged.
- [ ] Tests cover both repo-relative and repo-external output paths.

### US-004: Define Topdown Inventory Scope And Entry Points

**Description:** As a documentation operator, I want the topdown inventory scope and entry points fixed so that cleanup starts from system/module boundaries instead of stale leaf files.

**Acceptance Criteria:**
- [ ] Define active inventory scope as `docs/specs` plus `tasks` PRD markdown/JSON.
- [ ] Exclude `tasks/archive/**` and archived docs from active inventory unless explicitly targeted.
- [ ] Identify active entry/group/module roots for at least `definition-catalog`, `docs-control-plane`, `operational-ontology-system`, `operational-ontology-registry-allocation`, `programming-artifact-ontology-system`, and `authorization-ontology-system`.
- [ ] Document the traversal order: entry/group -> module -> role documents -> leaf/source evidence.
- [ ] Record the scope and ordering policy in `docs/specs/definition-catalog/docs-control-plane.plan.md` or an adjacent lifecycle inventory memo.
- [ ] Do not move files to archive or memo in this story.

### US-005: Build Document Role Matrix Inventory

**Description:** As a maintainer, I want each active family to show which role documents exist so that missing `todo`, `plan`, `rule`, `cases`, `test`, or `memo` files are visible.

**Acceptance Criteria:**
- [ ] Add or extend docs control-plane logic to compute a role matrix per family.
- [ ] Role matrix includes at least `spec`, `plan`, `todo`, `rule`, `cases`, `test`, `memo`, `knowledge`, `prd`, and `ralph-prd-json`.
- [ ] Role matrix distinguishes same-family files from graph-linked composition/refinement/trace documents.
- [ ] Role matrix excludes archive PRDs from active role coverage by default.
- [ ] `docs status <doc-id> --json` exposes role coverage or a role summary for the scoped family.
- [ ] Add tests covering a family with present and missing role documents.

### US-006: Standardize TODO Heading Categories

**Description:** As a documentation maintainer, I want open TODO items categorized by section heading so that `[ ]` can remain a checkbox while the heading expresses operational state.

**Acceptance Criteria:**
- [ ] Standardize canonical TODO headings:
  - `Completed — 완료 기록`
  - `Actionable — 실행 가능`
  - `Deferred — 조건부 대기`
  - `Parking Lot — 후보 보관`
- [ ] Update `docs-control-plane.todo.md` to use the canonical headings consistently.
- [ ] Update `programming-artifact-ontology-todo.todo.md` to categorize remaining open items.
- [ ] Update `operational-ontology-registry-allocation.todo.md` to categorize REST/remote activation as `Deferred`.
- [ ] Review `authorization-management-hardening.todo.md` and categorize at least the top-level groups without changing the technical meaning of items.
- [ ] `docs status ... --json` continues to expose `nextFollowUps[].category` for categorized TODO items.

### US-007: Detect Completed TODO And PRD Record Candidates

**Description:** As a documentation operator, I want completed TODO and PRD markdown records identified without automatically moving them so that archival decisions remain explicit.

**Acceptance Criteria:**
- [ ] Inventory detects `.todo.md` files with zero open checkboxes and at least one completed checkbox.
- [ ] Inventory detects PRD markdown files whose paired PRD JSON has all stories passing.
- [ ] Completed records are reported as `completed-record` or an equivalent non-actionable status.
- [ ] No files are moved to archive or converted to `.memo.md`.
- [ ] Existing completed TODO records such as event taxonomy rollout and RLSC text occupancy are listed in the report.
- [ ] Tests or fixture coverage verify completed records do not become actionable follow-ups.

### US-008: Improve PRD Completion Sync Scope Precision

**Description:** As a planner, I want PRD completion sync to use topdown family and role context so that completion candidates are relevant to the active family rather than broad trace matches.

**Acceptance Criteria:**
- [ ] `docs prd sync-completion` excludes archive PRD documents from active affected docs by default.
- [ ] `--family-only` limits completion candidates to the explicit PRD family and directly linked docs.
- [ ] Candidate reasons distinguish `target`, `role`, `composition`, `trace`, `source`, and `evidence`.
- [ ] Completed markdown PRDs paired with complete JSON do not become open work.
- [ ] Add tests for archive exclusion and role/family scoping.
- [ ] Existing `--include-session` behavior remains opt-in for transient `.ralph-tui` state.

### US-009: Align Docs Control Plane Family

**Description:** As a maintainer, I want the first topdown pass applied to `docs-control-plane` so that the inventory starts with the control-plane family that owns this workflow.

**Acceptance Criteria:**
- [ ] Review and align `docs-control-plane` role documents.
- [ ] Record existing roles, missing roles, actionable TODO count, deferred TODO count, parking-lot TODO count, and completed record candidates.
- [ ] Make only conservative document updates that clarify state.
- [ ] Do not invent new implementation scope.

### US-010: Align Operational Ontology Registry Allocation Family

**Description:** As a maintainer, I want the topdown pass applied to `operational-ontology-registry-allocation` so that registry lifecycle follow-ups are separated from completed local CLI work.

**Acceptance Criteria:**
- [ ] Review and align `operational-ontology-registry-allocation` role documents.
- [ ] Confirm REST activation and remote activation service remain `Deferred`.
- [ ] Record existing roles, missing roles, actionable TODO count, deferred TODO count, parking-lot TODO count, and completed record candidates.
- [ ] Make only conservative document updates that clarify state.
- [ ] Do not invent new implementation scope.

### US-011: Align Programming Artifact Ontology Family

**Description:** As a maintainer, I want the topdown pass applied to `programming-artifact-ontology-system` so that conditional provider and simulation follow-ups are correctly classified.

**Acceptance Criteria:**
- [ ] Review and align `programming-artifact-ontology-system` role documents.
- [ ] Confirm conditional provider, remote quality, and registry lifecycle items are not categorized as immediate actionable work unless their trigger condition is met.
- [ ] Record existing roles, missing roles, actionable TODO count, deferred TODO count, parking-lot TODO count, and completed record candidates.
- [ ] Make only conservative document updates that clarify state.
- [ ] Do not invent new implementation scope.

### US-012: Align Authorization Ontology Family

**Description:** As a maintainer, I want the topdown pass applied to `authorization-ontology-system` so that hardening follow-ups are visible and categorized before execution planning.

**Acceptance Criteria:**
- [ ] Review and align `authorization-ontology-system` role documents.
- [ ] Categorize `authorization-management-hardening.todo.md` top-level groups without changing their technical meaning.
- [ ] Record existing roles, missing roles, actionable TODO count, deferred TODO count, parking-lot TODO count, and completed record candidates.
- [ ] Make only conservative document updates that clarify state.
- [ ] Do not invent new implementation scope.

### US-013: Add Topdown Lifecycle Inventory Report

**Description:** As a documentation operator, I want a generated or maintained inventory report so that future cleanup PRDs can be prioritized from a stable source.

**Acceptance Criteria:**
- [ ] Create an inventory report under `docs/specs/definition-catalog/` or `tasks/`.
- [ ] Report includes role matrix summary for each prioritized family.
- [ ] Report includes open TODO category counts.
- [ ] Report includes completed record candidates.
- [ ] Report includes source-map gap count where available.
- [ ] Report recommends next PRD candidates in priority order.
- [ ] The report is generated or manually reproducible from documented CLI commands.

### US-014: Update Docs Control Plane Spec And README

**Description:** As a future maintainer, I want the docs control-plane spec and README to explain topdown lifecycle inventory so that this process is repeatable.

**Acceptance Criteria:**
- [ ] Update `docs/specs/definition-catalog/docs-control-plane.spec.md` with the topdown inventory concept.
- [ ] Update `packages/cli/src/lib/docs-control-plane/README.md` if command behavior or JSON output changes.
- [ ] Document that checkbox state remains binary and operational state comes from section headings.
- [ ] Document default exclusion of archive and transient session state.
- [ ] Document how to run the inventory and validation commands.
- [ ] Documentation does not claim automatic archival or automatic TODO promotion.

### US-015: Verify Topdown Inventory Operationally

**Description:** As a reviewer, I want command evidence showing the topdown lifecycle inventory works on real repository data.

**Acceptance Criteria:**
- [ ] Run `docs status docs-control-plane --json` and confirm `nextFollowUps` includes categorized actionable candidates.
- [ ] Run `docs status operational-ontology-registry-allocation --json` and confirm REST/remote activation are categorized as deferred.
- [ ] Run `docs status programming-artifact-ontology-system --json` and confirm conditional open items are not treated as actionable unless under an actionable heading.
- [ ] Run `docs status authorization-ontology-system --json` and confirm hardening follow-ups are visible.
- [ ] Run at least two `docs drift --prd ... --json` checks and confirm no default transient session drift.
- [ ] Run `def validate` after `def sync`.
- [ ] Record verification results in the PRD notes or the inventory report.

## Functional Requirements

- FR-1: The inventory must operate topdown from active group/module entry points.
- FR-2: The system must preserve existing markdown checkbox syntax.
- FR-3: TODO category must be inferred from section headings.
- FR-4: TODO hierarchy must be visible enough to distinguish parent and child checklist items.
- FR-5: `Actionable` work must sort before `Deferred` and `Parking Lot` work.
- FR-6: Completed records must remain visible without becoming active follow-up work.
- FR-7: Archive PRDs must be excluded from active inventory by default.
- FR-8: `.ralph-tui` session state must remain opt-in through `--include-session`.
- FR-9: Reports must be reproducible from documented CLI commands.
- FR-10: The work must not move files to archive or memo automatically.

## Non-Goals

- Automatic archive/memo conversion.
- Broad rewrite of all repository documentation.
- New frontmatter schema migration for TODO categories.
- Changing definition-catalog graph validation semantics.
- Changing ralph-tui JSON execution format.
- Implementing ontology pack authoring commands.
- Implementing REST activation endpoints.
- Implementing remote document storage or remote indexing.

## Technical Considerations

- Existing CLI/code surfaces:
  - `packages/cli/src/commands/docs.ts`
  - `packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts`
  - `packages/cli/src/lib/docs-control-plane/graph-scope.ts`
  - `packages/cli/src/lib/docs-control-plane/README.md`
- Existing docs to update:
  - `docs/specs/definition-catalog/docs-control-plane.spec.md`
  - `docs/specs/definition-catalog/docs-control-plane.plan.md`
  - `docs/specs/definition-catalog/docs-control-plane.todo.md`
  - `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
  - `docs/specs/authorization-ontology/authorization-management-hardening.todo.md`
- Existing command behavior to preserve:
  - `docs drift` default excludes transient session state.
  - `docs drift --include-session` includes `.ralph-tui/session-meta.json`.
  - `docs prd sync-completion` remains dry-run only.
  - `def validate` remains the authoritative graph validation gate.

## Success Metrics

- `docs status` returns categorized `nextFollowUps` for the core four families.
- Inventory commands can run in a narrow family-only mode.
- Parent TODO items and child checklist items are distinguishable.
- Deferred policy items no longer appear as urgent next work when actionable work exists.
- Completed PRD markdown and completed TODO records no longer produce default drift noise.
- The inventory report provides a clear next PRD candidate order.
- All quality gates pass.

## Open Questions

- Should `Parking Lot` items appear in `docs status` by default, or only with a future `--include-parking-lot` option?
- Should role matrix output be added directly to `docs status`, or introduced first as a separate `docs lifecycle inventory` command?
- Should completed TODO records eventually become `.memo.md`, or remain `.todo.md` with `Completed` sections?
- Should `Actionable` TODO counts influence future PRD scaffolding priority automatically?
[/PRD]
