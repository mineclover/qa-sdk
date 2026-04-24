# PRD: BDD Contract Mechanical Layer

## Overview

Add a mechanical BDD contract layer so `.cases.md` and `.test.md` documents can carry parseable `bdd_contract`, `test_unit`, and `implementation_unit` blocks. The first implementation exposes structured metadata, validation diagnostics, and a deterministic `BddContract → ScenarioSpec` compile surface. PipeGraph compile and test generation remain follow-up work.

## Why

The BDD concept is now part of the AI-DLC design, but without parser/schema support it remains a convention enforced by humans and skills. AI coding agents need a mechanical contract surface so test units and implementation units can be traced to the same contract id.

## Scope

### In Scope

- Add core BDD contract types and Zod schemas.
- Parse fenced YAML `bdd` blocks from `.cases.md` and `.test.md`.
- Normalize snake_case YAML to camelCase TypeScript IR.
- Project parsed contracts/units into `DocumentEnvelope.metadata.bdd`.
- Add validation diagnostics for missing references, duplicate contract ids, deterministic conflicts, and owner boundary mismatches.
- Add `qa-sdk docs bdd list|validate|units|compile|test-plan|impl-plan` as the first CLI surface.
- Add tests for core schema and docs-control-plane extraction.

### Out of Scope

- No PipeGraph compile command yet. `BddContract → ScenarioSpec` library compile is in scope.
- No writing test generator yet. Read-only `test-plan` preview is in scope.
- No `def validate` hard error integration yet.
- No frontmatter schema change.
- No DSPy/LLM involvement.

## User Stories

Implementation status: US-001 through US-008 are implemented for the Phase 1 read-model and ScenarioSpec compile library surface. PipeGraph command integration and test generation remain out of scope for this PRD.

### US-001: Define BDD core types and schemas

**Description:** As a tool author, I want `BddContract`, `BddTestUnit`, and `BddImplementationUnit` types with validation schemas so all consumers share the same contract shape.

**Acceptance Criteria:**

- `packages/core/src/types/bdd-contract.ts` defines BDD IR types.
- `packages/core/src/schema/bdd-contract.schema.ts` defines Zod schemas.
- `packages/core/src/index.ts` exports BDD types and schemas.
- Schema accepts snake_case input and returns normalized camelCase objects.
- Tests cover valid state transition, validation failure, invalid contract kind, missing owner system, and invalid implementation unit kind.
- `pnpm --filter @qa-sdk/core test -- bdd-contract` passes.

### US-002: Extract fenced YAML BDD blocks from definition markdown

**Description:** As a docs-control-plane consumer, I want `.cases.md` and `.test.md` documents to expose parsed BDD contracts in metadata so tools can inspect them.

**Acceptance Criteria:**

- `packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts` extracts fenced blocks starting with ````yaml bdd`.
- Extractor returns contracts, test units, implementation units, and diagnostics.
- `definition-markdown` adapter calls the extractor only for `cases` and `test` documents.
- Parsed output appears under `DocumentEnvelope.metadata.bdd`.
- Invalid BDD YAML creates diagnostics without dropping the document.
- Tests cover a valid `.cases.md`, valid `.test.md`, invalid YAML, and non-BDD markdown ignored.

### US-003: Validate contract/test/implementation references

**Description:** As a maintainer, I want BDD units to reference real contract ids so test and implementation work cannot drift.

**Acceptance Criteria:**

- Each `test_unit.contract` references a parsed `bdd_contract.id`.
- Each `implementation_unit.contract` references a parsed `bdd_contract.id`.
- Duplicate contract id in the same document produces a diagnostic.
- Missing test unit for a BDD contract produces a warning.
- Missing implementation unit for a write-mode BDD contract produces a warning.
- Diagnostics include source path and block pointer.

### US-004: Validate deterministic behavior keys

**Description:** As a reviewer, I want conflicting BDD contracts detected before tests or implementation are generated.

**Acceptance Criteria:**

- Deterministic key includes owner system, given state, when operation/event, and normalized predicates.
- Same key with different `then.state` or `then.error` produces an error diagnostic.
- `state-transition` without `given.state` or `then.state` produces an error.
- `validation-failure` without `then.error` produces an error.
- `mode: write` without any failure scenario in the same family produces a warning.

### US-005: Validate implementation unit ownership

**Description:** As an architect, I want implementation units to stay inside the owner system unless the contract explicitly calls for cross-system work.

**Acceptance Criteria:**

- `implementation_unit.owned_by` must equal `bdd_contract.owner_system` by default.
- Mismatch produces `cross-owner-implementation-unit` warning.
- Warning message suggests a separate contract or escalation.
- Tests cover matching owner, mismatched owner, and dependency-contract exception candidate.

### US-006: Document mechanical BDD workflow

**Description:** As a contributor, I want the BDD skill and proposal docs to reference the mechanical layer so implementation work follows the parser contract.

**Acceptance Criteria:**

- `docs/proposals/ai-dlc-dspy-harness/05-bdd-mechanical-design.md` describes the implementation design.
- `skills/bdd-contract/SKILL.md` references mechanical parsing once available.
- `docs/skills/automation-workflows.md` still points users to `bdd-contract` before `e2e-test`.
- `qa-sdk def validate` passes after docs updates.

### US-007: Expose BDD read model through docs CLI

**Description:** As a maintainer, I want BDD contracts and units visible through `qa-sdk docs` so I can inspect contract coverage without reading raw markdown.

**Acceptance Criteria:**

- `qa-sdk docs bdd list <doc-id|path> [--family-only] [--json]` lists parsed BDD contracts.
- `qa-sdk docs bdd validate <doc-id|path> [--family-only] [--json]` reports BDD diagnostics.
- `qa-sdk docs bdd units <doc-id|path> [--family-only] [--json]` groups test and implementation units by contract id.
- `qa-sdk docs bdd compile <doc-id|path> [--family-only] [--json]` returns deterministic ScenarioSpec output.
- `qa-sdk docs bdd test-plan <doc-id|path> [--family-only] [--json]` returns read-only test skeleton candidates.
- `qa-sdk docs bdd impl-plan <doc-id|path> [--family-only] [--json]` returns implementation units grouped by source target.
- Command descriptors are added under `docs.bdd.*`.
- Existing `docs status`, `docs collect`, and `docs graph` behavior remains backward compatible.
- JSON output is additive and omits `bdd` when no BDD block exists.

### US-008: Compile BDD contracts to ScenarioSpec

**Description:** As a tool author, I want a deterministic BDD-to-ScenarioSpec compiler so BDD contracts can become executable scenario IR without LLM involvement.

**Acceptance Criteria:**

- `packages/core/src/bdd-contract/compile-scenario.ts` exports `compileBddContractToScenarioSpec()`.
- `compileBddContractsToScenarioSpecs()` compiles batches and returns compile readiness issues.
- `scenario_id` is derived from `bdd_contract.id`.
- `domain` is derived from `owner_system`.
- `entry_conditions` include `given.state` and `given.predicates`.
- The single required step uses `when.event_key`, falling back to `when.operation`, then contract id.
- Step constraints include actor, operation, then state, emits, returns, egress, and error when present.
- Tests validate generated ScenarioSpec with `scenarioSpecSchema`.

## Functional Requirements

- FR-1: Parser must be read-only and must not rewrite `.cases.md` or `.test.md`.
- FR-2: Invalid BDD blocks must become diagnostics, not document parse failures.
- FR-3: BDD schema must not reuse existing scope-nesting `contractId` types.
- FR-4: BDD metadata must live under interpreter namespace `metadata.bdd`.
- FR-5: No LLM or DSPy code may be used in BDD parsing or validation.
- FR-6: Phase 1 CLI surface must be under `qa-sdk docs bdd`, not a new top-level command.
- FR-7: BDD-to-ScenarioSpec compile must be deterministic and must not call LLM/DSPy.
- FR-8: Test and implementation planners must be read-only previews in Phase 1.

## Quality Gates

- `pnpm --filter @qa-sdk/core test -- bdd-contract`
- `pnpm --filter @qa-sdk/core typecheck`
- `pnpm --filter @qa-sdk/cli test -- docs-control-plane`
- `pnpm --filter @qa-sdk/cli typecheck`
- `qa-sdk def validate`

## Open Questions

- [x] BDD validation spans same-family documents when `--family-only` is used. Per-document validation still preserves parse/schema diagnostics.
- [x] Missing implementation unit is a warning only for `mode: write` contracts.
- Should dependency-contract allow `implementation_unit.owned_by` to differ from `owner_system` when implementing adapters?
