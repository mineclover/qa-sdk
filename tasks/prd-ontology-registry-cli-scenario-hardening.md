[PRD]
# PRD: Ontology Registry CLI Scenario Hardening Before REST

## Overview

Before opening registry-service REST activation or a remote activation service, harden the local CLI proof for the completed ontology registry lifecycle. The goal is to make `qa-sdk ontology registry activate-pack` demonstrate the full lifecycle for both known packs, prove activation evidence consumption through the programming artifact registry, and document exactly which operator scenarios are already safe to rely on.

This is a pre-REST public/local follow-up. It must not add REST routes, remote service deployment, scoped prefix support, new registry-service tables, or new activation rollback semantics.

## Goals

- Convert the current implicit CLI coverage into an explicit scenario matrix.
- Prove `programming-artifact-ontology` and `authorization-ontology` activation through the same local CLI evidence path.
- Verify sidecar-only output, explicit activation evidence append, registry validate/list/extract consumption, rerun/upsert behavior, and duplicate/failure behavior.
- Keep REST activation endpoint and remote activation service out of scope until the local CLI lifecycle is stable enough to define API semantics.
- Update specs and roadmap docs so the next REST decision starts from completed local CLI evidence, not assumptions.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- ontology` - CLI ontology, activation, evidence, and artifact registry tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle validation
- `pnpm --filter operational-ontology test -- programming-artifacts` - programming artifact vocabulary/provider tests
- `pnpm --filter operational-ontology typecheck` - operational ontology type checking
- `pnpm --filter operational-ontology build` - operational ontology package build
- `pnpm --filter registry-service test -- ontology` - registry-service ontology lifecycle regression
- `pnpm --filter registry-service typecheck` - registry-service type checking
- `pnpm --filter registry-service build` - registry-service package build
- `pnpm --filter authorization-ontology test` - authorization pack regression
- `pnpm --filter authorization-ontology typecheck` - authorization pack type checking
- `pnpm --filter authorization-ontology build` - authorization pack build
- `node packages/cli/dist/index.js def validate` - definition-catalog validation

Build order note: run dependency builds before dependent builds when executing manually. Do not run `operational-ontology build` concurrently with `registry-service build`, because `registry-service` DTS generation consumes `operational-ontology/dist` declarations.

No browser verification is required.

## User Stories

### US-001: Close The Completed Local Lifecycle State

**Description:** As an ontology maintainer, I want the roadmap to distinguish completed local CLI lifecycle work from future REST/remote work so the next PRD does not reopen completed phases.

**Acceptance Criteria:**
- [x] Confirm the allocation lifecycle remains closed through Phase 5 plus activation CLI and activation evidence persistence.
- [x] Confirm `tasks/prd-ontology-registry-allocation-lifecycle-master.md` marks activation evidence persistence as completed.
- [x] Confirm this PRD is listed as the next pre-REST public/local follow-up.
- [x] Confirm `authorization-ontology-system.spec.md` no longer treats activation evidence persistence as pending.
- [x] Confirm REST activation endpoint, remote activation service, scoped prefix support, and production registry persistence remain out of scope.
- [x] Do not change runtime code in this story unless a doc reference points at a missing or renamed source.

**Confirmation Notes:**
- `tasks/prd-ontology-registry-allocation-lifecycle-master.md` keeps Phase 5 activation smoke completed, records activation CLI and activation evidence persistence as public/local post-lifecycle surfaces, and states there is no next allocation lifecycle implementation PRD.
- The same master roadmap marks activation evidence persistence as completed and lists this CLI scenario hardening PRD as the planned next pre-REST public/local follow-up before registry-service REST activation endpoint design.
- `docs/specs/authorization-ontology/authorization-ontology-system.spec.md` states activation evidence persistence is complete and keeps REST activation endpoint plus remote activation service as separate follow-up work.
- REST activation endpoint, remote activation service/deployment, scoped prefix support, production registry persistence, new registry-service tables, and activation rollback semantics remain out of scope for this PRD.
- No runtime code was changed for this closeout story.

### US-002: Add A CLI Scenario Matrix To The Specs

**Description:** As a workflow reviewer, I want the CLI scenario matrix documented so pack activation proof is evaluated consistently before REST design begins.

**Acceptance Criteria:**
- [x] Add a scenario matrix to `operational-ontology-registry-activation-cli.spec.md` or an adjacent spec section owned by that CLI surface.
- [x] Matrix rows include `programming-artifact-ontology` and `authorization-ontology`.
- [x] Matrix columns include activation success, sidecar-only output, activation evidence append, registry validate/list, artifact extraction registry hit, duplicate same-store failure, rerun/upsert same evidence identity, output write failure, registry append failure, unknown pack, invalid flag, and invalid address model.
- [x] Each implemented row links to a concrete test title or source reference.
- [x] Any uncovered row is explicitly marked as a gap and assigned to a later story in this PRD.
- [x] Matrix must not imply REST, remote service, scoped prefix, or rollback support.

**Confirmation Notes:**
- Added `docs/specs/operational-ontology/operational-ontology-registry-activation-cli-scenario-matrix.spec.md` as the adjacent validation spec owned by the activation CLI surface.
- The matrix includes `programming-artifact-ontology`, `authorization-ontology`, and CLI guardrail rows, with columns for activation success, sidecar-only output, evidence append, registry validate/list, artifact extraction registry hit, duplicate same-store failure, rerun/upsert identity, output write failure, registry append failure, unknown pack, invalid flag, and invalid address model.
- Implemented cells point at concrete `packages/cli/src/commands/ontology.test.ts` test titles. Authorization evidence gaps are assigned to US-004, pack-independent failure interpretation gaps to US-006, and cross-pack coexistence to US-005.
- The matrix states it is local CLI only and does not define REST activation, remote activation service, scoped prefix support, API idempotency, or rollback behavior.
- Corrected the activation CLI failure contract from `invalid-flag` to the implemented `invalid-cli-flag` code.

### US-003: Harden Programming Artifact Pack Evidence Replay

**Description:** As a CLI automation user, I want `programming-artifact-ontology` activation evidence to be replayable and inspectable so the local CLI proof can support future API design.

**Acceptance Criteria:**
- [x] Verify `programming-artifact-ontology --output <file>` remains sidecar-only and does not create or mutate an artifact registry.
- [x] Verify `programming-artifact-ontology --output <file> --artifact-registry <registry> --json` writes the sidecar before appending evidence.
- [x] Verify the registry validates and lists exactly one `activation-evidence` record for the command.
- [x] Verify `ontology prompt extract-artifact <output-file> --artifact-registry <registry> --json` resolves through `artifact-registry-hit`.
- [x] Verify successful rerun with the same pack/ontology/output identity upserts instead of duplicating evidence.
- [x] Verify duplicate/failed activation against the same store does not replace prior successful evidence.
- [x] Document the exact command sequence in `operational-ontology-registry-activation-cli.spec.md`.

**Confirmation Notes:**
- Tightened `packages/cli/src/commands/ontology.test.ts` sidecar-only coverage so `--output` without `--artifact-registry` proves no registry file is created and an unrelated existing registry file remains unchanged.
- Confirmed existing activation evidence tests cover sidecar-first append, registry validate/list with exactly one `activation-evidence` record, `extract-artifact` registry hit resolution, successful same-identity upsert, and failed duplicate non-replacement.
- Added the exact local replay command sequence and expected observations to `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`.

### US-004: Add Authorization Pack Evidence Persistence Proof

**Description:** As an authorization ontology maintainer, I want `authorization-ontology` to use the same activation evidence path as programming artifacts so both primary packs prove the lifecycle consistently.

**Acceptance Criteria:**
- [x] Add or confirm a CLI test invoking `ontology registry activate-pack authorization-ontology --output <file> --artifact-registry <registry> --json`.
- [x] Test uses an isolated SQLite activation store, sidecar output, and artifact registry JSON file.
- [x] Activation status is `succeeded`.
- [x] Output includes all expected authorization taxonomy allocation summaries.
- [x] Registry contains an `activation-evidence` record whose id is deterministic for `authorization-ontology`.
- [x] Evidence metadata summarizes authorization namespace, allocation count, sync statuses, smoke summary, warnings, and errors.
- [x] Registry validate/list accepts the authorization activation evidence.
- [x] `extract-artifact <authorization-output-file> --artifact-registry <registry> --json` resolves through `artifact-registry-hit`.
- [x] Duplicate same-store authorization activation does not append or replace successful evidence.
- [x] Update `authorization-ontology-system.spec.md` with the completed evidence proof when implemented.

**Confirmation Notes:**
- Added `packages/cli/src/commands/ontology.test.ts` coverage for `authorization-ontology --output <file> --artifact-registry <registry> --json` using isolated sidecar-only, first append, rerun, and duplicate activation stores.
- The scenario proves successful authorization activation, all eight taxonomy summaries, deterministic `activation-evidence-authorization-ontology-authorization-ontology` identity, authorization metadata summary, registry validate/list acceptance, `extract-artifact` `artifact-registry-hit`, successful rerun upsert, and failed duplicate non-replacement.
- Updated `authorization-ontology-system.spec.md`, `operational-ontology-registry-activation-cli.spec.md`, and the scenario matrix to record the completed authorization evidence proof.
- Required test/typecheck/build/def validate gates passed, with dependency builds run before `registry-service build`.

### US-005: Prove Cross-Pack Registry Coexistence

**Description:** As an operator, I want one local programming artifact registry to hold activation evidence for multiple ontology packs so pack proofs do not collide.

**Acceptance Criteria:**
- [x] Add a CLI scenario using one artifact registry file and separate isolated activation stores for `programming-artifact-ontology` and `authorization-ontology`.
- [x] Both successful activations append/upsert distinct `activation-evidence` records.
- [x] `ontology artifact registry list --kind activation-evidence --json` returns both records.
- [x] `ontology artifact registry validate --input <registry> --json` accepts the combined registry.
- [x] `extract-artifact` resolves each sidecar path to the correct pack evidence record.
- [x] Record ids, `producedByRef`, `derivedFromRefs`, `verifiesRefs`, and metadata remain pack-specific.
- [x] Re-running one pack does not mutate or duplicate the other pack's record.

**Confirmation Notes:**
- Added `packages/cli/src/commands/ontology.test.ts` coverage for one shared programming artifact registry populated by successful `programming-artifact-ontology` and `authorization-ontology` activations from separate SQLite stores and separate sidecar paths.
- The scenario proves two distinct activation evidence records, combined registry validate/list acceptance, per-sidecar `extract-artifact` `artifact-registry-hit` resolution, pack-specific ids/provenance/ref arrays/metadata, and programming rerun upsert without mutating or duplicating the authorization record.
- Updated `operational-ontology-registry-activation-cli.spec.md` and the scenario matrix to record the completed cross-pack coexistence proof.

### US-006: Document Operator Failure Interpretation

**Description:** As an operator, I want CLI failures to have stable interpretation before REST error mapping is designed.

**Acceptance Criteria:**
- [ ] Document the current no-rollback policy and structured failed activation result policy in the CLI spec.
- [ ] Document command-level failures separately from helper lifecycle failures.
- [ ] Document that registry append failure makes the command fail while preserving the successful activation sidecar.
- [ ] Document that duplicate same-store activation is a structured helper failure, not a successful idempotent activation.
- [ ] Document that REST idempotency and remote store ownership are intentionally undecided.
- [ ] Verify existing tests or add missing tests for sidecar preservation, append failure sanitization, and no failed-evidence append.

### US-007: Reflect CLI Hardening Completion In Roadmap Docs

**Description:** As a documentation maintainer, I want the completed CLI hardening result reflected in specs and TODOs so REST planning starts from stable evidence.

**Acceptance Criteria:**
- [ ] Update `tasks/prd-ontology-registry-allocation-lifecycle-master.md` with this PRD completion status.
- [ ] Update `operational-ontology-registry-allocation.todo.md` to close CLI scenario hardening when complete.
- [ ] Update `operational-ontology-registry-activation-cli.spec.md` with final scenario matrix and operator interpretation.
- [ ] Update `programming-artifact-ontology-cli.spec.md` if registry provider behavior changed or additional consumption evidence was added.
- [ ] Update `authorization-ontology-system.spec.md` if authorization evidence proof changed.
- [ ] Keep REST activation endpoint and remote activation service open as separate follow-ups.
- [ ] Keep scoped prefix implementation frozen.

## Functional Requirements

- FR-1: CLI scenario hardening must use the existing local activation runtime and must not start a registry-service HTTP server.
- FR-2: Evidence persistence must remain explicit: `--artifact-registry` requires `--output`.
- FR-3: `--output` alone must remain sidecar-only.
- FR-4: Failed activation results must not be appended as managed activation evidence.
- FR-5: Registry append failure must not rewrite the successful activation sidecar.
- FR-6: Pack evidence identities must remain deterministic and pack-specific.
- FR-7: Existing artifact registry validate/list/provider lookup must consume the records without new provider schema.
- FR-8: REST/remote/scoped-prefix behavior must remain documented as non-goal follow-up work.

## Non-Goals

- Registry-service REST activation endpoint.
- Remote activation service or deployment workflow.
- Scoped prefix schema/API/index-meta/decode migration.
- Cross-boundary rollback or compensating rollback.
- New registry-service persistence tables.
- New artifact relation vocabulary.
- Changing activation helper lifecycle ordering.
- Making duplicate same-store activation a successful idempotent operation.

## Technical Considerations

- Main CLI sources:
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/commands/ontology.test.ts`
  - `packages/cli/src/lib/activation-evidence-registry.ts`
  - `packages/cli/src/lib/known-ontology-packs.ts`
- Registry-service lifecycle sources:
  - `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`
  - `packages/registry-service/src/modules/ontology/local-activation-runtime.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`
- Pack sources:
  - `packages/operational-ontology/src/programming-artifacts.ts`
  - `packages/authorization-ontology/src/index.ts`
- Existing evidence mapper already uses `activation-evidence` and deterministic `activation-evidence-<packId>-<ontologyId>` identity.
- Prefer adding missing tests to existing CLI ontology tests before introducing a new test file, unless the scenario matrix makes the current file too hard to maintain.

## Success Metrics

- A maintainer can point to a single CLI scenario matrix and see which local activation behaviors are proven.
- Both known packs prove successful activation evidence persistence and provider consumption.
- Combined registry evidence for multiple packs validates and resolves without collisions.
- REST planning can reuse CLI result semantics without guessing about local lifecycle behavior.
- `node packages/cli/dist/index.js def validate` reports zero warnings.

## Open Questions

- None for this PRD. REST endpoint auth, tenancy, remote store ownership, API idempotency, and deployment lifecycle are intentionally deferred to a separate REST/remote PRD.
[/PRD]
