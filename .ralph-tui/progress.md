# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Planning-only lifecycle boundary stories should close acceptance criteria in the execution PRD before implementation stories run: record the lifecycle boundary, selected vocabulary value, rejected alternatives, and 5Q rationale in the PRD itself.
- CLI ontology tests consume exported workspace packages through their built `dist/` entrypoints; after changing exported operational-ontology vocabulary or pack code, run `pnpm --filter operational-ontology build` before CLI tests.
- `pnpm --filter @qa-sdk/cli test -- ontology` is a Vitest path/name filter; CLI-local helper tests that must run under this gate should live in `ontology.test.ts` or include `ontology` in the test file name.

---

## 2026-04-15 - US-001
- Confirmed the activation evidence persistence plan is a post-lifecycle public/local follow-up over the completed `qa-sdk ontology registry activate-pack` CLI, not a new allocation lifecycle phase.
- Checked the lifecycle master boundary: after Phase 5 there is no next lifecycle implementation PRD; Phase 6 remains policy-only and scoped prefix implementation stays frozen under `operational-ontology-scoped-prefix-decision`.
- Defined the managed evidence contract as `--output <file>` plus explicit artifact registry append; `--output` alone remains a sidecar-only JSON materialization.
- Chose `activation-evidence` as the artifact kind before implementation, rejected `deployment-output`, `quality-status`, and `prompt-artifact`, and documented the 5Q rationale for adding the vocabulary value in the next story.
- Did not implement persistence, REST activation, remote activation service, or scoped prefix support in this story.
- Files changed: `tasks/prd-ontology-registry-activation-evidence-persistence.md`, `tasks/prd-ontology-registry-activation-evidence-persistence.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `ArtifactRegistryPromptArtifactContextProvider` resolves records generically by artifact ref/output path, but `quality-status` is special-cased for governance closure, freshness, ledger, and prompt quality behavior.
  - Reusing `quality-status` for activation proof would make lifecycle evidence look like gate/audit evidence; a new `activation-evidence` kind keeps provider behavior explicit without changing the provider in this story.
  - The existing `programming_artifact_kind` capacity remains 16 after adding a sixth value because `nextPowerOf2(6 * 2) = 16`.
---

## 2026-04-15 - US-002
- Added `activation-evidence` to the programming artifact kind vocabulary and kept `programming_artifact_kind` capacity at 16.
- Added operational ontology coverage that models activation evidence through existing `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, and `materializes_output` relations only.
- Extended CLI registry append/list/validate coverage so `activation-evidence` is accepted by the shared programming artifact kind validation path.
- Updated programming artifact specs for the 5Q result, artifact vocabulary definition, registry CLI contract, development guide, todo list, and context simulation review. The simulation matrix did not get a new activation evidence row because this story adds vocabulary only; the future append/consumption story owns that scenario.
- Files changed: `packages/operational-ontology/src/internal/programming-artifact-core.ts`, `packages/operational-ontology/src/programming-artifacts.test.ts`, `packages/cli/src/commands/ontology.test.ts`, `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`, `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`, `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation.spec.md`, `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md`, `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `PROGRAMMING_ARTIFACT_KINDS` in `programming-artifact-core.ts` is the SSOT for the ontology pack axis, metadata vocabulary, TypeScript `ProgrammingArtifactKind`, and CLI registry kind validation.
  - `activation-evidence` can be represented by the existing relation fields: command provenance via `produced_by`, pack/import source via `derived_from`, pack/allocation proof via `verifies`, activation CLI ownership via `owned_by_definition`, and sidecar/result refs via `materializes_output`.
  - CLI ontology tests initially rejected `activation-evidence` until `operational-ontology` was rebuilt, because the CLI package imports `operational-ontology/programming-artifacts` from `dist/`.
---

## 2026-04-15 - US-003
- Added a pure CLI-local activation evidence mapper that converts an activation result plus resolved output sidecar path and command context into a programming artifact registry record.
- The mapper rejects missing/blank output paths, creates deterministic `activation-evidence-<packId>-<ontologyId>` record ids, points `artifactRef`/`outputPath` at the sidecar, records command provenance, pack/import derivation, verification refs, activation CLI ownership, sidecar/result materialization refs, and activation summary metadata.
- Added mapper unit coverage under the required ontology test filter for successful mapping, deterministic id generation, missing output path rejection, and metadata shape.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `node packages/cli/dist/index.js def validate`.
- Files changed: `packages/cli/src/lib/activation-evidence-registry.ts`, `packages/cli/src/lib/activation-evidence-registry.ontology.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - A CLI-local structural activation result type keeps the mapper independent of registry-service private module exports while remaining compatible with the helper result shape.
  - Activation evidence should summarize sync and smoke state in `metadata` and keep `materializesOutputRefs` to the sidecar plus a stable activation-result ref, rather than listing every generated index-meta prefix.
  - The CLI test wrapper forwards trailing args directly to Vitest, so new helper tests need an ontology-matching file path/name to be covered by the required `-- ontology` gate.
---
