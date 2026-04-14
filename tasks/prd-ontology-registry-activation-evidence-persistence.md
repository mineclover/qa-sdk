[PRD]
# PRD: Ontology Registry Activation Evidence Persistence

## Overview

Persist successful `qa-sdk ontology registry activate-pack` results as managed programming artifact registry evidence. The activation CLI already writes optional JSON sidecars with `--output`; this PRD adds an explicit artifact registry append path so successful pack activation proof can be discovered by `ontology artifact registry list`, validated by registry tooling, and consumed later by artifact-context workflows.

This is a post-lifecycle follow-up, not Phase 6. It must not reopen registry allocation internals, scoped prefix policy, registry-service REST exposure, or remote activation service design.

## Goals

- Add a stable artifact registry representation for ontology activation evidence.
- Keep `--output` as sidecar materialization and require an explicit registry flag for managed persistence.
- Preserve the activation helper result JSON contract unless an explicit additive CLI persistence field is documented.
- Prove programming-artifact ontology activation evidence can be appended, listed, validated, and used as an artifact registry hit.
- Update specs, TODO, and the lifecycle master so the next roadmap state is explicit.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/cli test -- ontology` - CLI ontology and artifact registry tests
- `pnpm --filter @qa-sdk/cli typecheck` - CLI type checking
- `pnpm --filter @qa-sdk/cli build` - CLI bundle used by local command checks
- `pnpm --filter operational-ontology test -- programming-artifacts` - programming artifact vocabulary/provider tests
- `pnpm --filter operational-ontology typecheck` - operational ontology type checking
- `pnpm --filter registry-service test -- ontology` - activation helper/local runtime regression
- `pnpm --filter registry-service typecheck` - registry-service type checking
- `node packages/cli/dist/index.js def validate` - definition-catalog validation

No browser verification is required.

## User Stories

### US-001: Confirm Post-Lifecycle Boundary And Evidence Contract

**Description:** As an ontology maintainer, I want the next execution plan scoped outside the allocation lifecycle so that activation evidence persistence does not reopen Phase 6 or registry-service internals.

**Acceptance Criteria:**
- [ ] Confirm `tasks/prd-ontology-registry-allocation-lifecycle-master.md` says there is no next lifecycle implementation PRD after Phase 5.
- [ ] Confirm this PRD is a public/follow-up surface over the completed activation CLI.
- [ ] Confirm scoped prefix implementation remains frozen under `operational-ontology-scoped-prefix-decision`.
- [ ] Confirm registry-service REST endpoint and remote activation service remain out of scope.
- [ ] Define the managed evidence contract as `--output <file>` plus explicit artifact registry append, not implicit append from `--output` alone.
- [ ] Compare reusing existing artifact kinds (`deployment-output`, `quality-status`, `prompt-artifact`) against adding `activation-evidence`, and record why the chosen kind does or does not confuse provider behavior.
- [ ] Decide the artifact kind before implementation and document the 5Q rationale if a vocabulary value is added.
- [ ] Do not implement persistence in this story.

### US-002: Add Activation Evidence Artifact Vocabulary

**Description:** As a programming artifact ontology maintainer, I want activation proof to have an explicit artifact kind so it is not mislabeled as build, prompt, deployment, or quality-status output.

**Acceptance Criteria:**
- [ ] Add `activation-evidence` to the programming artifact kind vocabulary if no existing kind fits without confusing provider behavior.
- [ ] Document the 5Q result for `activation-evidence`: finite, decision-affecting, shared by activation CLI and artifact registry/provider flows, stable, and still within capacity 16.
- [ ] Do not add a new relation kind; reuse `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, and `materializes_output`.
- [ ] Update `programmingArtifactOntologyPack` and related tests so the pack remains valid.
- [ ] Update programming artifact specs to describe `activation-evidence`.
- [ ] Review whether `programming-artifact-ontology-context-simulation.spec.md` needs a new row for activation evidence consumption; update it only if the new kind changes scenario matrix behavior.
- [ ] Ensure activation of `programming-artifact-ontology` still succeeds with the expanded vocabulary.

### US-003: Build Activation Result To Registry Record Mapping

**Description:** As a CLI maintainer, I want a deterministic mapper from activation result plus output path to a programming artifact registry record so CLI code does not hand-build ad hoc JSON.

**Acceptance Criteria:**
- [ ] Add a pure mapper in `packages/cli/src/lib/activation-evidence-registry.ts` unless an existing CLI-local helper is clearly a better fit.
- [ ] Mapper input includes activation result, resolved output path, registry command context, and optional timestamp injection for tests.
- [ ] Mapper rejects missing output path because registry persistence must point at materialized evidence.
- [ ] Record uses deterministic identity, for example `activation-evidence-<packId>-<ontologyId>`.
- [ ] Record `artifactRef` and `outputPath` point to the activation output sidecar.
- [ ] Record `kind` is the selected activation evidence artifact kind.
- [ ] Record `producedByRef` records the `qa-sdk ontology registry activate-pack <pack-id>` command surface.
- [ ] Record `derivedFromRefs` includes the pack id and, when stable, the known pack import ref.
- [ ] Record `verifiesRefs` includes the pack id, ontology id, and `operational-ontology-registry-allocation`.
- [ ] Record `ownerDefinitionId` is `operational-ontology-registry-activation-cli`.
- [ ] Record `materializesOutputRefs` includes the activation output sidecar path and a stable activation result ref; avoid enumerating every generated index-meta prefix unless a future story needs that granularity.
- [ ] Record metadata summarizes status, namespace, allocation count, sync status counts, smoke check summary, warnings/errors counts, and generated timestamp.
- [ ] Unit tests cover successful mapping, deterministic id generation, missing output path rejection, and metadata shape.

### US-004: Append Activation Evidence From The CLI

**Description:** As an automation user, I want `activate-pack` to append successful activation evidence to a programming artifact registry when I explicitly provide a registry path.

**Acceptance Criteria:**
- [ ] Add `--artifact-registry <file>` to `qa-sdk ontology registry activate-pack`.
- [ ] `--artifact-registry` requires `--output <file>` and returns a structured CLI error if the output sidecar path is missing.
- [ ] `--output` alone continues to write the activation result sidecar without appending to the artifact registry.
- [ ] Successful activation writes the output sidecar first, then appends the activation evidence record to the registry.
- [ ] Failed activation does not append a managed artifact registry record.
- [ ] Output write failure does not append a managed artifact registry record.
- [ ] Artifact registry append failure is sanitized and does not expose raw filesystem or SQL internals.
- [ ] Text output reports the registry append path and record id when append succeeds.
- [ ] JSON output remains backward-compatible with the activation result payload; append details are added under an additive `activationEvidence` field containing registry path, record id/ref, record count, and append status.
- [ ] Command usage/help and invalid flag validation include `--artifact-registry`.

### US-005: Prove Registry Evidence End To End

**Description:** As a workflow maintainer, I want a real activation command to create registry evidence that existing artifact registry commands can list, validate, and resolve.

**Acceptance Criteria:**
- [ ] Add CLI test invoking `ontology registry activate-pack programming-artifact-ontology --output <file> --artifact-registry <registry> --json`.
- [ ] Test uses isolated temporary SQLite store, output sidecar, and artifact registry JSON file.
- [ ] Activation status is `succeeded`.
- [ ] Registry file contains exactly one activation evidence record for the activation output.
- [ ] `ontology artifact registry validate --input <registry> --json` accepts the registry.
- [ ] `ontology artifact registry list --input <registry> --kind activation-evidence --json` returns the activation evidence record.
- [ ] `ontology prompt extract-artifact <output-file> --artifact-registry <registry> --json` resolves through `artifact-registry-hit` by matching the evidence record `artifactRef` or `outputPath` to the activation sidecar path.
- [ ] Re-running the same successful command upserts the same activation evidence record instead of duplicating it.
- [ ] A duplicate/failed activation against the same store does not replace the successful evidence record with failed evidence.

### US-006: Reflect Evidence Persistence In Docs And TODO

**Description:** As a documentation maintainer, I want specs and roadmap docs to state that activation evidence persistence is complete and still separate from REST and scoped-prefix work.

**Acceptance Criteria:**
- [ ] Update `operational-ontology-registry-activation-cli.spec.md` with `--artifact-registry` behavior and failure contract.
- [ ] Update `operational-ontology-registry-allocation.spec.md` to mention activation evidence persistence as a public/local follow-up surface, not a lifecycle phase.
- [ ] Update `operational-ontology-registry-allocation.todo.md` to close the activation evidence persistence follow-up when implemented.
- [ ] Update `programming-artifact-ontology-cli.spec.md` and `programming-artifact-ontology-system.spec.md` for activation evidence kind and registry behavior.
- [ ] Keep REST activation endpoint and remote activation service follow-ups open.
- [ ] Keep scoped prefix implementation frozen unless a separate decision PRD/implementation ADR reopens it.

## Functional Requirements

- FR-1: `activate-pack --artifact-registry` must only append managed registry evidence when the activation result status is `succeeded`.
- FR-2: `activate-pack --artifact-registry` must require an output sidecar path so the registry record points at materialized evidence.
- FR-3: `--output` without `--artifact-registry` must preserve the current sidecar-only behavior.
- FR-4: The registry append path must reuse existing programming artifact registry append/upsert helpers.
- FR-5: The activation helper and registry-service store/sync lifecycle must remain unchanged.
- FR-6: The evidence record must be resolvable by existing artifact registry provider lookup through artifact ref or output path.
- FR-7: The implementation must not add REST routes, remote service deployment, scoped prefixes, or new persistence tables.

## Non-Goals

- Registry-service REST activation endpoint.
- Remote activation service or deployment workflow.
- Scoped prefix schema/API/index-meta/decode migration.
- Changing activation helper lifecycle ordering or rollback policy.
- Appending failed activation results as managed proof records.
- Replacing `--output` with artifact registry persistence.
- Adding new relation vocabulary unless a separate design story proves it is required.

## Technical Considerations

- Likely CLI files:
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/commands/ontology.test.ts`
  - `packages/cli/src/lib/programming-artifact-registry.ts`
- Likely programming artifact files:
  - `packages/operational-ontology/src/internal/programming-artifact-core.ts`
  - `packages/operational-ontology/src/programming-artifacts.test.ts`
  - `packages/operational-ontology/src/programming-artifacts.ts`
- Existing activation CLI sources:
  - `packages/cli/src/lib/known-ontology-packs.ts`
  - `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`
  - `packages/registry-service/src/modules/ontology/local-activation-runtime.ts`
- Existing registry append helper upserts by artifact id, artifact ref, or output path.
- If the implementation adds `activation-evidence`, capacity remains 16 because `(6 values * 2) = 12` and `nextPowerOf2(12) = 16`.

## Success Metrics

- A maintainer can run one local command to activate a known ontology pack, write activation JSON, and append managed registry evidence.
- Existing artifact registry validate/list commands can inspect the activation evidence without custom tooling.
- `extract-artifact` can resolve the activation output through the registry provider.
- The allocation lifecycle remains closed, and Phase 6 scoped-prefix policy remains untouched.

## Open Questions

- None for initial execution. If `activation-evidence` is rejected during US-001, update this PRD before implementing US-002 through US-005.
[/PRD]
