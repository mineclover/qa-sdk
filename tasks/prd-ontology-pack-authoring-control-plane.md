[PRD]
# PRD: Ontology Pack Authoring Control Plane

## Overview

This PRD adds an authoring control plane for creating and validating `OperationalOntologyPack` based domain ontology packs. The current system has a solid runtime contract: packs can be declared as `OperationalOntologyPack`, validated with `validateOperationalOntologyPack()`, resolved as known packs, and activated through the registry/index-meta lifecycle. What is missing is a maintainer-facing scaffold and validation workflow that helps authors create a new pack consistently with code, tests, definition docs, source-map references, and known-pack registration candidates.

The feature centers on `operational-ontology-pack-interface` as the canonical pack contract. Pack authoring should preserve an architecture-neutral Entity/Component/System-informed separation. ECS is one concrete architecture that demonstrates this separation, and operational ontology can model ECS, but scaffolded packs must not become ECS-specific unless the requested domain is explicitly an ECS pack.

- Entity-like identity: stable identifiers only, such as `packId`, axis ids, taxonomy ids, artifact ids, and definition ids.
- Component-like data: data-only schemas and records, such as axes, taxonomies, relation categories, traversals, registry records, and artifact records.
- System-like transform: explicit transformation or validation logic, such as validators, allocators, projectors, activation helpers, sync adapters, and docs graph traversal.

The scaffold workflow must keep these concerns separate. It must not hide behavior inside schema declarations, and it must not mutate known-pack registries or activate packs implicitly.

## Goals

- Make `OperationalOntologyPack` authoring repeatable and less error-prone.
- Add a dry-run first `qa-sdk ontology pack scaffold <pack-id>` workflow.
- Generate pack implementation, test, and definition document scaffold candidates.
- Generate source-map and known-pack registration candidates.
- Add pack validation that checks runtime pack shape plus source/test/docs/known-pack readiness.
- Encode architecture-neutral identity/data/system separation in generated templates and docs, using ECS only as a reference model.
- Keep generated output conservative and reversible.
- Preserve existing pack activation/runtime behavior.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- docs` - docs control-plane and CLI regression tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter operational-ontology test -- pack` - operational ontology pack validation regression
- `node packages/cli/dist/index.js def validate` - definition graph and source-map validation

Operational verification commands for affected stories:

- `node packages/cli/dist/index.js docs status operational-ontology-pack-interface --json`
- `node packages/cli/dist/index.js def find-by-file packages/operational-ontology/src/internal/pack-core.ts`
- `node packages/cli/dist/index.js docs drift --prd tasks/prd-docs-topdown-lifecycle-inventory-alignment.json --json`

No browser verification is required.

## User Stories

### US-001: Define Pack Authoring Scope And CLI Contract

**Description:** As an ontology maintainer, I want the pack authoring scope and CLI command contract defined before implementation so scaffold behavior is predictable and bounded.

**Acceptance Criteria:**
- [ ] Define `qa-sdk ontology pack scaffold <pack-id>` as the primary CLI surface.
- [ ] Define `qa-sdk ontology pack validate <pack-ref>` as the validation surface.
- [ ] Document that `OperationalOntologyPack` remains the canonical pack contract.
- [ ] Document that pack authoring preserves architecture-neutral separation of entity-like ids, component-like data, and system-like transforms.
- [ ] Document that operational ontology can model ECS but is not limited to ECS.
- [ ] Document that scaffold is dry-run by default.
- [ ] Document that file writes require explicit `--write`.
- [ ] Document that known-pack registration is reported as a candidate, not applied automatically.
- [ ] Document that registry activation is out of scope for scaffold.
- [ ] Update relevant command help/usage strings without implementing behavior-heavy logic in this story.

### US-002: Add Pack Scaffold Planning Model

**Description:** As a CLI maintainer, I want a structured scaffold plan model so dry-run and write modes share one source of truth.

**Acceptance Criteria:**
- [ ] Add a scaffold plan type that includes identity declarations, component schema files, system binding files, docs paths, source-map candidates, and known-pack candidate.
- [ ] Validate pack id format as a safe kebab-case entity id.
- [ ] Derive default symbol names from the pack id.
- [ ] Derive default package path from options or safe defaults.
- [ ] Separate generated component-like schema content from generated system-like binding/blueprint content.
- [ ] Support CLI options for implementation package/root, docs directory, test file path, and dry-run/write mode.
- [ ] Return structured diagnostics for invalid ids, unsafe paths, and conflicting output paths.
- [ ] Add unit tests for plan generation without writing files.

### US-003: Implement Dry-Run Pack Scaffold Preview

**Description:** As a pack author, I want to preview the files and edits that would be created before writing anything.

**Acceptance Criteria:**
- [ ] `qa-sdk ontology pack scaffold <pack-id> --json` returns a structured dry-run preview.
- [ ] Preview includes pack implementation skeleton content.
- [ ] Preview includes test skeleton content.
- [ ] Preview includes definition docs skeletons for spec, todo, plan, and optional rule/cases/test docs.
- [ ] Preview includes source-map frontmatter candidates.
- [ ] Preview includes known-pack registration candidate for `packages/cli/src/lib/known-ontology-packs.ts`.
- [ ] Preview identifies identity declarations, component-like declarations, and system-like bindings separately.
- [ ] Preview does not modify the filesystem.
- [ ] Tests prove dry-run leaves no generated files behind.

### US-004: Implement Explicit Write Mode For Pack Scaffold

**Description:** As a pack author, I want scaffold output written only when I explicitly request it.

**Acceptance Criteria:**
- [ ] `qa-sdk ontology pack scaffold <pack-id> --write` writes scaffold files.
- [ ] Write mode creates parent directories as needed.
- [ ] Write mode refuses to overwrite existing files unless a future explicit overwrite option is added.
- [ ] Write mode emits the same file list as dry-run preview.
- [ ] Write mode still treats known-pack registration as a candidate unless a separate explicit flag is introduced.
- [ ] Write mode emits clear JSON and text summaries.
- [ ] Tests use temporary directories and verify generated content.

### US-005: Add Pack Implementation Skeleton Template

**Description:** As a pack author, I want generated TypeScript pack skeletons that satisfy the `OperationalOntologyPack` contract and preserve architecture-neutral identity/data/system separation.

**Acceptance Criteria:**
- [ ] Generated implementation imports or references `OperationalOntologyPack`.
- [ ] Generated implementation exports a named pack constant satisfying `OperationalOntologyPack`.
- [ ] Skeleton includes a dedicated identity constants section.
- [ ] Skeleton includes a dedicated component-like schema section for axes, taxonomies, relation categories, and traversals.
- [ ] Skeleton includes a dedicated system-like binding section for blueprints.
- [ ] Generated template avoids ECS-specific naming unless the requested pack itself is an ECS pack.
- [ ] Skeleton includes at least one example axis with stable capacity.
- [ ] Skeleton includes at least one taxonomy using the axis.
- [ ] Skeleton includes empty or minimal relation categories and traversals.
- [ ] Skeleton includes a validation helper calling `validateOperationalOntologyPack`.
- [ ] Generated code is deterministic for the same input.
- [ ] Tests verify generated skeleton can be parsed or typechecked in fixture context where practical.

### US-006: Add Pack Test Skeleton Template

**Description:** As a pack author, I want a generated test skeleton that proves the new pack can be validated.

**Acceptance Criteria:**
- [ ] Generated test imports the pack and validation helper.
- [ ] Generated test asserts `validate...Pack().valid === true`.
- [ ] Generated test includes placeholders for domain-specific axis/taxonomy expectations.
- [ ] Generated test includes a placeholder for blueprint/system binding expectations.
- [ ] Test skeleton path defaults next to the implementation file or follows package test conventions.
- [ ] Tests verify generated test skeleton is deterministic.
- [ ] Scaffold preview and write mode include the test skeleton.

### US-007: Add Definition Docs Family Scaffold

**Description:** As a documentation maintainer, I want generated definition docs for a new pack so docs and code start aligned.

**Acceptance Criteria:**
- [ ] Generate a `<pack-id>-system.spec.md` skeleton with frontmatter.
- [ ] Generate a `<pack-id>-todo.todo.md` skeleton with `Completed`, `Actionable`, `Deferred`, and `Parking Lot` headings.
- [ ] Generate a `<pack-id>-plan.plan.md` skeleton.
- [ ] Optionally generate `<pack-id>.rule.md`, `<pack-id>.cases.md`, and `<pack-id>.test.md` when requested.
- [ ] Spec skeleton links to `operational-ontology-pack-interface`.
- [ ] Spec skeleton includes an architecture-neutral separation section mapping identity declarations, component schema, and system bindings for the new pack.
- [ ] Spec skeleton states that ECS is a possible modeled architecture, not the only supported architecture.
- [ ] Spec skeleton includes source references for implementation and test candidates.
- [ ] TODO skeleton starts with actionable authoring checklist and no fake completed work.
- [ ] Tests verify frontmatter contains valid `def.id`, `level`, `scope`, `aspect`, `depth`, and lifecycle values.

### US-008: Add Source-Map Candidate Generation

**Description:** As a docs operator, I want scaffold output to identify source-map edits so new pack code can be found by `def find-by-file` and `docs graph`.

**Acceptance Criteria:**
- [ ] Scaffold preview reports source-map candidate paths for implementation and test files.
- [ ] Spec skeleton includes conservative top-level `sources:` entries for generated implementation/test paths.
- [ ] Candidate output distinguishes generated files from suggested edits to existing docs.
- [ ] `def find-by-file` guidance is included in preview output.
- [ ] No source comments are added by default.
- [ ] Tests verify source-map candidate paths are repository-relative and normalized.

### US-009: Add Known-Pack Registration Candidate

**Description:** As an ontology operator, I want scaffold output to show how a new pack would be added to known-pack resolution without mutating the resolver automatically.

**Acceptance Criteria:**
- [ ] Scaffold preview includes a known-pack candidate targeting `packages/cli/src/lib/known-ontology-packs.ts`.
- [ ] Candidate includes import path, pack id, and export symbol name.
- [ ] Candidate is marked as manual by default.
- [ ] Scaffold write mode does not mutate known-pack resolver automatically.
- [ ] Add tests verifying candidate generation for kebab-case pack ids.
- [ ] Unknown pack activation behavior remains unchanged.

### US-010: Implement Pack Validate CLI

**Description:** As a pack author, I want a validation command that checks a pack against the runtime contract and authoring readiness.

**Acceptance Criteria:**
- [ ] Add `qa-sdk ontology pack validate <pack-ref>`.
- [ ] Validate runtime pack shape using `validateOperationalOntologyPack()`.
- [ ] Report pack validation issues with source, path, code, and message.
- [ ] When pack-ref is a known pack id, resolve it through known-pack resolver.
- [ ] When pack-ref is a file path, load or import it using a documented supported path.
- [ ] Validate referenced implementation/test files where paths are statically available from blueprints or scaffold metadata.
- [ ] Validate docs/source-map readiness when a matching docs family exists.
- [ ] JSON output includes `valid`, `issues`, `packId`, `identity`, `componentSchema`, `systemBindings`, and readiness sections.
- [ ] Text output is concise and actionable.

### US-011: Add Pack Authoring Docs And Rules

**Description:** As a future maintainer, I want documentation explaining how to create a pack through the scaffold workflow.

**Acceptance Criteria:**
- [ ] Update `operational-ontology-pack-interface.spec.md` with scaffold/validate workflow.
- [ ] Add or update a rule/cases document describing pack authoring decisions.
- [ ] Document pack id naming rules.
- [ ] Document scaffold dry-run/write policy.
- [ ] Document known-pack registration candidate policy.
- [ ] Document source-map candidate policy.
- [ ] Document identity/data/system separation as the authoring philosophy.
- [ ] Document ECS as a useful reference model, not as the only supported architecture.
- [ ] Documentation explicitly says scaffold does not activate packs.
- [ ] Documentation references existing programming-artifact and authorization packs as examples.

### US-012: Verify Pack Authoring Workflow Operationally

**Description:** As a reviewer, I want command evidence proving scaffold and validate work without breaking existing packs.

**Acceptance Criteria:**
- [ ] Run dry-run scaffold for a temporary pack id and record JSON summary.
- [ ] Run write-mode scaffold in a temporary directory and verify files are created.
- [ ] Run pack validate for `programming-artifact-ontology`.
- [ ] Run pack validate for `authorization-ontology`.
- [ ] Run docs status for `operational-ontology-pack-interface`.
- [ ] Run `def validate`.
- [ ] Run all quality gates.
- [ ] Record verification results in PRD notes or a generated inventory/report file.

## Functional Requirements

- FR-1: Pack authoring must use `OperationalOntologyPack` as the canonical contract.
- FR-2: Pack authoring must preserve architecture-neutral separation of identity declarations, data-only component schema, and explicit system bindings.
- FR-3: Operational ontology may model ECS, but pack scaffold templates must not be ECS-specific unless explicitly requested.
- FR-4: Scaffold must be dry-run by default.
- FR-5: Write mode must require explicit `--write`.
- FR-6: Scaffold must not mutate known-pack resolver automatically.
- FR-7: Scaffold must not activate packs.
- FR-8: Generated paths must be safe and repository-relative unless explicitly output to a temporary or external directory.
- FR-9: Generated docs must use valid definition-catalog frontmatter.
- FR-10: Validation must surface runtime pack issues and authoring readiness issues separately.
- FR-11: Existing known pack activation behavior must remain unchanged.
- FR-12: All output must be deterministic for the same input/options.

## Non-Goals

- Registering new known packs automatically.
- Activating newly scaffolded packs.
- Adding REST endpoints.
- Adding remote pack registry storage.
- Moving existing packs to a new package layout.
- Rewriting authorization ontology into sub-packs.
- Adding a UI for pack authoring.
- Automatic archive/memo conversion for docs.
- Implementing ECS-specific runtime scheduling, archetypes, or SoA storage optimization as part of this scaffold PRD.

## Technical Considerations

- Core contract:
  - `packages/operational-ontology/src/internal/pack-core.ts`
  - `packages/operational-ontology/src/pack.ts`
- Existing pack examples:
  - `packages/operational-ontology/src/internal/programming-artifact-core.ts`
  - `packages/authorization-ontology/src/index.ts`
- Known pack resolver:
  - `packages/cli/src/lib/known-ontology-packs.ts`
- Likely CLI files:
  - `packages/cli/src/command-groups/ontology.commands.ts`
  - `packages/cli/src/commands/ontology.ts`
  - possibly new `packages/cli/src/commands/ontology/pack-authoring.ts`
- Existing docs:
  - `docs/specs/operational-ontology/operational-ontology-pack-interface.spec.md`
  - `docs/specs/definition-catalog/docs-control-plane.todo.md`
- Preserve separation:
  - `operational-ontology-pack-interface` defines pack contract.
  - `operational-ontology-registry-allocation` owns activation lifecycle.
  - `docs-control-plane` owns document inventory and PRD context.

## Success Metrics

- A maintainer can run scaffold dry-run and understand all generated files/candidates.
- A maintainer can write scaffold files into a temp package without overwriting existing files.
- A maintainer can validate existing known packs from CLI.
- New pack docs start with valid frontmatter and source-map candidates.
- Generated templates visibly separate identity declarations, component schema, and system bindings.
- Existing known pack activation tests remain unaffected.
- All quality gates pass.

## Open Questions

- Should file-path pack validation support dynamic import directly, or only validate known pack ids in the first version?
- Should scaffold create `.cases.md` and `.test.md` by default, or only via flags?
- Should known-pack candidate output be a patch preview or a structured JSON object?
- Should generated pack skeleton live under `packages/operational-ontology/src/internal/` by default or under a new package path?
[/PRD]
