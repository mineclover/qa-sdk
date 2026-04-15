# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Build validation for registry-service consumers should run dependency builds first; do not run `operational-ontology build` concurrently with `registry-service build` because registry-service DTS generation consumes operational-ontology declarations.
- Activation evidence replay hardening should prove sidecar-only output, sidecar-first append, registry validate/list, `extract-artifact` provider hit, rerun upsert, and failed duplicate non-replacement in one CLI scenario proof.
- Activation evidence registry records normalize duplicate refs; when pack id, ontology id, or known import ref are the same value, assertions should expect deduplicated `derivedFromRefs`/`verifiesRefs`.
- Cross-pack activation evidence coexistence should use one registry file with isolated activation stores and distinct sidecar paths; assertions should verify record id/ref/path-specific upsert so rerunning one pack leaves the other record unchanged.

---

## 2026-04-15 - US-001
- Closed the completed local lifecycle state in the CLI scenario hardening PRD by marking US-001 acceptance criteria complete and recording confirmation notes.
- Verified the allocation lifecycle remains closed through Phase 5 plus activation CLI and activation evidence persistence, with no next lifecycle implementation PRD.
- Verified activation evidence persistence is completed in the lifecycle master and authorization ontology docs, while REST activation endpoint, remote activation service, scoped prefix support, production registry persistence, new registry-service tables, and rollback semantics remain out of scope.
- No runtime code was changed.
- Files changed: `tasks/prd-ontology-registry-cli-scenario-hardening.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter operational-ontology build`; `pnpm --filter authorization-ontology build`; `pnpm --filter registry-service build`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service typecheck`; `pnpm --filter authorization-ontology typecheck`; `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter authorization-ontology test`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Planning closeout stories can be completed by checking the master roadmap, the active execution PRD, and adjacent system specs, then recording evidence without reopening implementation docs that already state the current behavior.
  - `authorization-ontology-system.spec.md` lives under `docs/specs/authorization-ontology/`, not the operational ontology spec directory referenced by several nearby docs.
  - The manual build gate order matters because registry-service declaration generation reads built operational ontology outputs.
---

## 2026-04-15 - US-002
- Added an adjacent activation CLI scenario matrix spec that records proven local CLI behavior and explicit gaps before REST design begins.
- Matrix rows cover `programming-artifact-ontology`, `authorization-ontology`, and CLI guardrails; required scenario columns are present with concrete CLI test title/source references.
- Marked authorization evidence rows as US-004 gaps, pack-independent failure interpretation rows as US-006 gaps, and cross-pack coexistence as US-005 follow-up scope.
- Corrected the activation CLI failure contract from `invalid-flag` to the implemented `invalid-cli-flag` code.
- Marked US-002 complete in the CLI scenario hardening PRD JSON/Markdown.
- Files changed: `docs/specs/operational-ontology/operational-ontology-registry-activation-cli-scenario-matrix.spec.md`, `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter authorization-ontology test`; `pnpm --filter authorization-ontology typecheck`; `pnpm --filter authorization-ontology build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Existing CLI ontology tests already prove the programming-artifact activation evidence path end to end, including validate/list, extract-artifact registry hits, rerun upsert identity, and failed duplicate non-replacement.
  - The authorization pack currently has CLI activation success coverage only; sidecar, evidence append, registry consumption, duplicate, and rerun/upsert proof are intentionally US-004 gaps.
  - CLI guardrail scenarios such as unknown pack, invalid flag, and invalid address model are command-surface proofs, not pack-specific activation rows.
  - The implemented invalid flag code is `invalid-cli-flag`; specs should not use the older `invalid-flag` label.
---

## 2026-04-15 - US-003
- Hardened the `programming-artifact-ontology` activation evidence replay proof by tightening sidecar-only CLI coverage so `--output` without `--artifact-registry` proves no registry file is created and an unrelated existing registry file is unchanged.
- Documented the exact local replay command sequence in `operational-ontology-registry-activation-cli.spec.md`, including sidecar-only output, sidecar-first append, validate/list, `extract-artifact` registry hit, successful rerun upsert, and duplicate same-store non-replacement expectations.
- Marked US-003 complete in the CLI scenario hardening PRD Markdown/JSON.
- Files changed: `packages/cli/src/commands/ontology.test.ts`, `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `pnpm --filter authorization-ontology test`; `pnpm --filter authorization-ontology typecheck`; `pnpm --filter authorization-ontology build`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter @qa-sdk/cli build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - The existing `registry activation evidence is consumable end to end and upserts successful reruns` test already covers validate/list, provider hit, same-identity upsert, and duplicate failed activation non-replacement for programming artifacts.
  - The sidecar-first ordering is proven both by the append success test and the append failure test because append failure still leaves a raw successful sidecar without `activationEvidence` metadata.
  - For build validation, `operational-ontology build` must complete before `registry-service build`; CLI build can run after registry-service declarations are refreshed.
---

## 2026-04-15 - US-004
- Added authorization activation evidence replay coverage for `authorization-ontology --output <file> --artifact-registry <registry> --json`, using isolated sidecar-only, first append, rerun, and duplicate SQLite activation stores.
- Proved succeeded activation, all eight authorization taxonomy summaries, deterministic `activation-evidence-authorization-ontology-authorization-ontology` record identity, authorization namespace/allocation/sync/smoke/warning/error metadata, registry validate/list, `extract-artifact` `artifact-registry-hit`, successful rerun upsert, and duplicate same-store non-replacement.
- Updated the authorization system spec, activation CLI spec, scenario matrix, and CLI hardening PRD to mark US-004 complete.
- Files changed: `packages/cli/src/commands/ontology.test.ts`, `docs/specs/authorization-ontology/authorization-ontology-system.spec.md`, `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`, `docs/specs/operational-ontology/operational-ontology-registry-activation-cli-scenario-matrix.spec.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter authorization-ontology test`; `pnpm --filter authorization-ontology typecheck`; `pnpm --filter authorization-ontology build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - The activation evidence path is pack-independent once `knownOntologyPackImportRef()` resolves the pack source ref; authorization uses the same programming artifact registry provider as programming artifacts.
  - Registry record creation deduplicates repeated refs, so authorization evidence has a single `authorization-ontology` `derivedFromRefs` entry even though pack id and import ref are identical.
  - A single CLI scenario can cover sidecar-only output, sidecar-first append, registry consumption, successful rerun upsert, and duplicate failed non-replacement for authorization without adding pack-specific runtime code.
---

## 2026-04-15 - US-005
- Added a cross-pack CLI scenario proving one programming artifact registry can hold activation evidence for `programming-artifact-ontology` and `authorization-ontology` from separate isolated SQLite activation stores and distinct sidecar paths.
- Proved both successful activations append distinct `activation-evidence` records, combined registry validate/list accepts both, `extract-artifact` resolves each sidecar to the matching pack record, and rerunning programming-artifact evidence does not mutate or duplicate the authorization record.
- Updated the activation CLI spec, scenario matrix, and CLI hardening PRD Markdown/JSON to mark US-005 complete.
- Files changed: `packages/cli/src/commands/ontology.test.ts`, `docs/specs/operational-ontology/operational-ontology-registry-activation-cli.spec.md`, `docs/specs/operational-ontology/operational-ontology-registry-activation-cli-scenario-matrix.spec.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.md`, `tasks/prd-ontology-registry-cli-scenario-hardening.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter operational-ontology build`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `pnpm --filter registry-service build`; `pnpm --filter authorization-ontology test`; `pnpm --filter authorization-ontology typecheck`; `pnpm --filter authorization-ontology build`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - Cross-pack registry coexistence depends on distinct sidecar `artifactRef`/`outputPath` values; registry upsert matches by `artifactId`, `artifactRef`, or `outputPath`.
  - `extract-artifact` proves the correct activation evidence record through `workArea.workAreaId` and relation-derived constraints, while `source.registry.recordCount` reflects all registry records loaded from the shared file.
  - Rerun safety should snapshot the untouched pack record and compare it after the other pack upsert, because the rerun pack may legitimately refresh generated evidence metadata.
---
