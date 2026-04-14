# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Planning-only lifecycle boundary stories should close acceptance criteria in the execution PRD before implementation stories run: record the lifecycle boundary, selected vocabulary value, rejected alternatives, and 5Q rationale in the PRD itself.
- CLI ontology tests consume exported workspace packages through their built `dist/` entrypoints; after changing exported operational-ontology vocabulary or pack code, run `pnpm --filter operational-ontology build` before CLI tests.
- `pnpm --filter @qa-sdk/cli test -- ontology` is a Vitest path/name filter; CLI-local helper tests that must run under this gate should live in `ontology.test.ts` or include `ontology` in the test file name.
- `activate-pack --artifact-registry` keeps `--output` as the raw activation result sidecar; append metadata is reported in stdout JSON under additive `activationEvidence`, so registry append failures do not rewrite the materialized proof.
- Activation evidence upsert tests need a fresh SQLite activation store for the second succeeded run with the same registry/output identity; reusing the original store intentionally exercises `duplicate-allocation` failure and should assert no failed evidence append.

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

## 2026-04-15 - US-004
- Added `--artifact-registry <file>` to `qa-sdk ontology registry activate-pack` usage, help, command descriptors, and structured flag validation.
- Integrated successful activation evidence appends through the existing programming artifact registry upsert helper, only after the activation result sidecar is written successfully.
- Preserved `--output`-only behavior as sidecar-only JSON and prevented managed registry writes for helper failures, missing output sidecars, output write failures, and sanitized append failures.
- Added additive JSON stdout details under `activationEvidence` with append status, registry path, record id/ref, and record count; text output now reports registry append path and record id on success.
- Added ontology CLI coverage for missing `--output`, successful append, text append reporting, failed activation no-append behavior, output write failure no-append behavior, sanitized append failure output, and supported flag validation.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `node packages/cli/dist/index.js def validate`.
- Files changed: `packages/cli/src/commands/ontology.ts`, `packages/cli/src/commands/ontology.test.ts`, `packages/cli/src/command-groups/ontology.commands.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The activation command has a custom parser (`parseRegistryActivatePackArgs`) rather than using the generic `parseFlags`; adding a command option requires updating the usage string, value flag set, command descriptor, and help text together.
  - The output sidecar writer is the sequencing boundary for managed evidence: build and append the registry record only after `writeJsonPayloadFile()` returns a resolved output path.
  - Append failure can be represented without leaking Node filesystem internals by returning a sanitized `activationEvidence.appendStatus: "failed"` block while leaving the raw activation sidecar intact.
---

## 2026-04-15 - US-005
- Added an end-to-end CLI ontology test that runs `ontology registry activate-pack programming-artifact-ontology --output <file> --artifact-registry <registry> --json` against isolated temporary SQLite stores, a sidecar output file, and a JSON artifact registry.
- Verified the generated activation evidence record is the only activation evidence entry, validates through `ontology artifact registry validate`, lists through `ontology artifact registry list --kind activation-evidence`, and resolves through `ontology prompt extract-artifact` as an `artifact-registry-hit` for the activation sidecar path.
- Covered successful rerun upsert behavior with the same evidence identity and confirmed a duplicate failed activation against the original store does not append or replace successful registry evidence with failed evidence.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `node packages/cli/dist/index.js def validate`.
- Files changed: `packages/cli/src/commands/ontology.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The registry evidence consumer path is fully generic for activation evidence: matching `artifactRef`/`outputPath` to the sidecar is enough for `prompt extract-artifact` to return `artifact-registry-hit`.
  - Same-store activation reruns are intentionally failed by duplicate allocation checks, so registry upsert coverage for another successful activation needs a separate activation store while keeping the same output path and artifact registry.
  - Failed activation results still materialize their own sidecar when `--output` is provided, but managed registry evidence is appended only for `status: "succeeded"`.
---
