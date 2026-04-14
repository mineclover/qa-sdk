[PRD]
# PRD: Ontology Registry Activation CLI & Scenario Proof

## Overview

Expose the completed internal ontology registry activation lifecycle through a local CLI command. Phase 5 proved the internal lifecycle: pack validation, reservation, activation, index-meta sync, product/sum smoke checks, and structured activation result payloads. This PRD makes that lifecycle executable by agents and maintainers from `qa-sdk ontology`, then proves it with real pack scenarios for programming-artifact ontology and authorization ontology.

This PRD is the first public-facing execution surface, but it remains local and file/SQLite oriented. It does not add registry-service REST endpoints, production deployment workflows, scoped prefix support, or artifact evidence persistence.

## Goals

- Add an ontology registry activation CLI command.
- Resolve known pack ids to actual exported `OperationalOntologyPack` objects.
- Support local SQLite-backed activation runtime.
- Emit machine-readable activation result JSON.
- Prove programming-artifact ontology activation through CLI.
- Prove authorization ontology activation through CLI.
- Prove structured failure output for invalid/duplicate/drift scenarios.
- Reflect the CLI surface in docs/spec/todo.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- ontology` - CLI ontology tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter registry-service test` - Registry-service lifecycle tests
- `pnpm --filter registry-service typecheck` - Registry-service type checking
- `pnpm --filter registry-service build` - Registry-service build
- `pnpm --filter operational-ontology test -- allocation` - Allocation regression
- `pnpm --filter authorization-ontology test` - Authorization ontology pack tests
- `node packages/cli/dist/index.js def validate` - Definition-catalog validation

No browser verification is required.

## User Stories

### US-001: Discover Pack Sources and CLI Runtime Boundary

**Description:** As a CLI maintainer, I want known ontology pack sources and local runtime boundaries documented so the activation command does not guess imports or storage behavior.

**Acceptance Criteria:**
- [ ] Confirm `operational-ontology-registry-allocation.spec.md` states Phase 5 internal lifecycle is complete and this CLI is an optional public/local execution surface, not a new lifecycle phase.
- [ ] Identify known pack ids supported by the CLI: at least `programming-artifact-ontology` and `authorization-ontology`.
- [ ] Confirm `programmingArtifactOntologyPack` is importable from `operational-ontology/programming-artifacts`.
- [ ] Confirm `authorizationOntologyPack` is importable from `authorization-ontology`.
- [ ] Add `authorization-ontology` as a CLI dependency if required.
- [ ] Document the local SQLite runtime strategy for registry-service/index-meta stores.
- [ ] Confirm command path and flags before implementation.
- [ ] Do not implement the command in this story.

### US-002: Add Known Pack Resolver

**Description:** As a CLI user, I want the activation command to resolve stable pack ids so I can activate known ontology packs without writing custom JSON fixtures.

**Acceptance Criteria:**
- [ ] Add a CLI-local known pack resolver for `programming-artifact-ontology`.
- [ ] Add a CLI-local known pack resolver for `authorization-ontology`.
- [ ] Unknown pack id returns a structured error listing supported pack ids.
- [ ] Resolver does not import test fixtures.
- [ ] Resolver can be unit tested without creating SQLite stores.

### US-003: Build Local Activation Runtime

**Description:** As a CLI maintainer, I want a local activation runtime so the CLI can call the internal activation helper without requiring a running registry-service server.

**Acceptance Criteria:**
- [ ] Add helper code to construct registry-service ontology store, prefix registry, schema version store, sync adapter, service, and activation helper for a local SQLite path.
- [ ] Support `--store <path>` for persistent local SQLite state.
- [ ] Support an in-memory/test runtime if useful for tests.
- [ ] Runtime reuses existing registry-service store and index-meta APIs.
- [ ] Runtime does not start a Nest HTTP server.
- [ ] Runtime does not add REST API calls.

### US-004: Add `ontology registry activate-pack` Command

**Description:** As a CLI user, I want a command to activate a known ontology pack so I can run the internal lifecycle from the terminal.

**Acceptance Criteria:**
- [ ] Add command descriptor for `qa-sdk ontology registry activate-pack <pack-id>`.
- [ ] Wire handler through `cliOntology`.
- [ ] Support flags: `--store <path>`, `--ontology-id <id>`, `--namespace <namespace>`, `--owner <owner>`, `--version <versionId>`, `--address-model product|sum`, and `--json`.
- [ ] Support prefix overrides for taxonomy ids using a deterministic flag shape, for example `--prefix <taxonomyId>=<prefix>`.
- [ ] Command calls `activateOntologyPack()` or `OntologyPackActivationHelper`.
- [ ] Command does not reimplement activation lifecycle logic.

### US-005: Define JSON Output and Error Contract

**Description:** As an automation user, I want stable JSON output so activation results can be consumed by agents, tests, and future artifact workflows.

**Acceptance Criteria:**
- [ ] `--json` emits the activation result payload from the helper.
- [ ] Successful output includes `status`, `packId`, `ontologyId`, `namespaceSummary`, `allocationSummaries`, `syncSummariesByAllocationId`, `smokeCheckSummary`, `warnings`, and `errors`.
- [ ] Failure output includes structured failed activation result when helper returns one.
- [ ] Unknown pack and invalid CLI flag errors produce JSON when `--json` is present.
- [ ] Raw SQL errors are not exposed in JSON output.
- [ ] Non-JSON output is concise and includes status, pack id, allocation count, smoke summary, and action hints.

### US-006: Prove Programming Artifact Ontology Activation Scenario

**Description:** As an ontology maintainer, I want the CLI to activate programming-artifact ontology so that artifact vocabulary allocation is proven through the real command path.

**Acceptance Criteria:**
- [ ] Add CLI test invoking `ontology registry activate-pack programming-artifact-ontology --json`.
- [ ] Test uses isolated temporary SQLite store.
- [ ] Output status is `succeeded`.
- [ ] Output includes allocation summaries for programming artifact kind/relation taxonomy surfaces.
- [ ] Output includes successful sync summaries and smoke checks.
- [ ] Re-running the same command against the same store is idempotent or returns the documented structured failure if activation is not intended to be idempotent.

### US-007: Prove Authorization Ontology Activation Scenario

**Description:** As an ontology maintainer, I want the CLI to activate authorization ontology so that a real domain ontology pack is proven through the activation lifecycle.

**Acceptance Criteria:**
- [ ] Add CLI test invoking `ontology registry activate-pack authorization-ontology --json`.
- [ ] Test uses isolated temporary SQLite store.
- [ ] Output status is `succeeded`.
- [ ] Output includes authorization ontology allocation summaries.
- [ ] Output includes successful sync summaries and smoke checks.
- [ ] The test validates that known authorization ontology axes/taxonomies are represented in activation output.

### US-008: Prove CLI Failure Scenarios

**Description:** As a CLI user, I want predictable failure output so automation can distinguish bad input, lifecycle conflicts, and drift.

**Acceptance Criteria:**
- [ ] Unknown pack id returns a structured error and non-zero exit code.
- [ ] Invalid `--address-model` returns a structured error and non-zero exit code.
- [ ] Duplicate prefix/version or drift scenario returns activation result with `status: "failed"` and structured errors.
- [ ] Failure output does not expose raw SQL.
- [ ] Tests cover JSON and non-JSON failure output where practical.

### US-009: Optionally Persist Activation Result Output

**Description:** As an automation user, I want to save activation results to a file so that later workflows can inspect activation evidence.

**Acceptance Criteria:**
- [ ] Add `--output <file>` support if it fits existing CLI output conventions.
- [ ] Saved output is the same JSON payload emitted by `--json`.
- [ ] Parent directories are created as needed.
- [ ] This story does not append to programming artifact registry yet.
- [ ] If `--output` is deferred, document the reason and leave a follow-up TODO.

### US-010: Reflect CLI Surface in Docs and TODO

**Description:** As an ontology documentation maintainer, I want the activation CLI reflected in specs and TODO so the next scenario-proof work starts from current behavior.

**Acceptance Criteria:**
- [ ] Add or update CLI spec documentation for `ontology registry activate-pack`.
- [ ] Update `operational-ontology-registry-allocation.spec.md` to mention CLI activation surface.
- [ ] Update `operational-ontology-registry-allocation.todo.md` if public CLI exposure closes a tracked gap.
- [ ] Update programming-artifact/authorization scenario docs only if tests prove those scenarios.
- [ ] Keep REST API exposure and artifact registry persistence as follow-up work.

## Functional Requirements

- FR-1: CLI must call the internal activation helper; it must not duplicate lifecycle logic.
- FR-2: CLI must support at least programming-artifact ontology and authorization ontology known pack ids.
- FR-3: CLI must run without a registry-service HTTP server.
- FR-4: CLI must use isolated local SQLite stores in tests.
- FR-5: CLI JSON output must be stable and machine-readable.
- FR-6: CLI failure output must be structured and safe.
- FR-7: CLI must not implement scoped prefixes, REST API exposure, or artifact evidence persistence in this PRD.

## Non-Goals

- Registry-service REST endpoints.
- Production deployment workflow.
- Scoped prefix support.
- Artifact registry append for activation output.
- Remote registry-service activation.
- UI/browser flows.

## Technical Considerations

- CLI command files:
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/command-groups/ontology.commands.ts`
  - `packages/cli/src/commands/ontology.test.ts`
- Pack sources:
  - `operational-ontology/programming-artifacts`
  - `authorization-ontology`
- Internal lifecycle sources:
  - `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`
- Local runtime should reuse registry-service/index-meta stores rather than create new persistence abstractions.

## Success Metrics

- Maintainers can activate known ontology packs through `qa-sdk ontology registry activate-pack`.
- Programming artifact ontology activation is proven via CLI test.
- Authorization ontology activation is proven via CLI test.
- JSON result can be consumed by future scenario/evidence workflows.
- Internal lifecycle remains the SSOT.

## Open Questions

- Should command path be `ontology registry activate-pack` or `ontology pack activate`?
- Should repeat activation be idempotent at CLI level or return structured `invalid-transition` because allocations are already active?
- Should activation output persistence become an artifact registry story immediately after this PRD?
[/PRD]
