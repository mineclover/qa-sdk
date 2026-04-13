# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Artifact registry sidecar evidence: keep direct registry hit/miss routing unchanged, then use `listArtifacts()` to attach related records as additive source evidence and JSON summaries.
- Quality-status snapshot loading: treat `outputPath` JSON as additive closure evidence; valid snapshots become governance-run source refs, while missing/invalid files produce structured JSON warnings and extraction continues.
- Prompt quality sidecar evidence: keep new scoring signals optional on the evaluator input, pass them only from artifact extraction, and use verified evidence as an additive bonus while failed/missing evidence becomes governance warnings.
- Quality export registry metadata: keep provider reads on existing relation/output fields, and add closure summaries under optional `metadata` so old registry consumers remain compatible.

---

## 2026-04-13 - US-001
- Implemented/verified `extract-artifact --artifact-registry` related `quality-status` discovery for requested artifact, definition, and work-area refs.
- Confirmed direct artifact registry lookup remains backward compatible while related quality records are merged as additional prompt governance evidence.
- Documented the provider, CLI JSON `qualityStatusRecords`, prompt quality closure behavior, plan milestone, TODO status, and verification workflow updates.
- Verification: operational-ontology checks passed; targeted ontology CLI tests passed; full CLI test run is blocked in this sandbox by existing DKG tests that require a writable default state DB and `127.0.0.1` listener.
- Files changed:
  - `packages/cli/src/commands/ontology.ts`
  - `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-plan.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Direct registry hit lookup is separate from sidecar quality discovery; preserving that split keeps hit/miss/fallback behavior stable.
  - Related quality matching is intentionally constrained to existing quality record fields: `kind`, `verifiesRefs`, `materializesOutputRefs`, `sourceRefs`, `outputPath`, and `relations`.
  - Fallback commands receive the registry flags, so `extract-file` and definition extraction can recompute related quality evidence after they resolve the authoritative work-area refs.
  - Full CLI tests may need `QA_SDK_HOME`/network-capable test runners because unrelated DKG coverage opens SQLite state and a local HTTP ingest listener.
---

## 2026-04-13 - US-002
- Implemented safe loading of matched `quality-status` record `outputPath` quality export JSON snapshots during ontology prompt extraction.
- Added snapshot metadata to `source.qualityStatusRecords.records[]` and structured warning output for missing, invalid JSON, invalid shape, and read-failure paths.
- Converted valid snapshot bundle gate status into `quality-export-snapshot` governance run evidence so prompt quality can reason over real bundle/gate closure.
- Updated programming artifact ontology system/CLI/plan/todo/development guide docs and prompt artifact generation behavior docs.
- Verification: operational-ontology typecheck/test/build passed; CLI typecheck/build and targeted `ontology.test.ts` passed; full CLI test remains blocked by existing DKG SQLite state DB and `127.0.0.1` listener sandbox failures; `def sync` and `def validate` passed.
- Files changed:
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/commands/ontology.test.ts`
  - `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-plan.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Snapshot paths need both cwd-relative and registry-file-relative resolution because quality export writes portable paths while tests and local registries may live outside the repo root.
  - Existing fallback source shapes can stay stable by adding snapshot details under `source.qualityStatusRecords` instead of changing `source.kind`.
  - Prompt quality closure distinguishes synthetic `:definition-context` runs from real governance evidence, so snapshot-derived runs should use a non-synthetic run id.
  - Missing files are now a meaningful warning path whenever a matched quality record has `outputPath`.
---

## 2026-04-13 - US-003
- Added optional `PromptArtifactQualityStatusEvidence` input to prompt quality evaluation and wired artifact extraction to pass matched quality-status evidence into `governance_closure` scoring.
- Made verified target evidence with verified bundles/gates improve governance closure additively, while missing, failed, stale, invalid, or incomplete evidence emits governance warnings and does not silently improve the score.
- Preserved non-artifact prompt extraction behavior by only passing the new evidence from `extract-artifact` or hidden artifact-source fallback context.
- Updated programming artifact ontology system/CLI/plan/todo/development guide docs and prompt artifact generation behavior docs.
- Verification: operational-ontology typecheck/test/build passed; CLI typecheck/build and targeted ontology CLI tests passed; `def sync` and `def validate` passed; full CLI test remains blocked by pre-existing sandbox-sensitive DKG SQLite/local listener failures.
- Files changed:
  - `packages/operational-ontology/src/internal/prompt-artifact-core.ts`
  - `packages/operational-ontology/src/prompt-artifacts.ts`
  - `packages/operational-ontology/src/prompt-artifacts.test.ts`
  - `packages/cli/src/commands/ontology.ts`
  - `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-plan.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `evaluatePromptArtifactQuality()` can remain backward compatible by treating absent `qualityStatusEvidence` differently from an explicitly empty evidence array.
  - Artifact extraction fallback can be distinguished from direct `prompt extract` / `extract-file` calls by the hidden `artifact-source` flag, which is the right place to preserve old non-artifact scoring behavior.
  - The existing CLI full test suite still has unrelated sandbox blockers: DKG SQLite state path setup and `127.0.0.1` listener permission in audit forwarding.
---

## 2026-04-13 - US-004
- Enriched `quality export --artifact-registry` `quality-status` records with closure metadata: root id, generated timestamp, bundle count/states, per-bundle gate/claim counts, and aggregate totals.
- Preserved existing registry compatibility by keeping `verifiesRefs` as root id + bundle ids, `materializesOutputRefs` as the root quality system id, and `verificationRefs` populated with bundle ids.
- Updated quality registry tests to verify enriched metadata and existing relation refs, and documented the registry/provider/CLI/prompt closure contract changes.
- Removed the duplicate `prompt-artifact-core.ts` source mapping from `programming-artifact-ontology-system` so definition validation has one authoritative boundary for that file.
- Verification: operational-ontology typecheck/test/build passed; CLI typecheck/build and targeted `quality.test.ts` passed; `def sync` and `def validate` passed. Full CLI test still fails on unrelated sandbox-sensitive DKG cases: default SQLite state DB open and `127.0.0.1` listener EPERM.
- Files changed:
  - `packages/cli/src/commands/quality.ts`
  - `packages/cli/src/commands/quality.test.ts`
  - `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-plan.plan.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
  - `docs/specs/operational-ontology/programming-artifact-ontology-development-guide.spec.md`
  - `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Registry record enrichment can stay backward compatible by placing closure details under optional `metadata` and leaving provider matching on the existing refs/output fields.
  - `quality export` snapshots already contain enough bundle/gate/claim state to derive both per-bundle summaries and aggregate totals without introducing registry-service allocation persistence.
  - Definition validation treats broad `sources:` mappings as authoritative code boundaries, so cross-concept docs should mention shared implementation files in body text instead of claiming them in frontmatter.
---
