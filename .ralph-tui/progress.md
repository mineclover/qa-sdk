# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Artifact registry sidecar evidence: keep direct registry hit/miss routing unchanged, then use `listArtifacts()` to attach related records as additive source evidence and JSON summaries.
- Quality-status snapshot loading: treat `outputPath` JSON as additive closure evidence; valid snapshots become governance-run source refs, while missing/invalid files produce structured JSON warnings and extraction continues.

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
