# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Artifact registry sidecar evidence: keep direct registry hit/miss routing unchanged, then use `listArtifacts()` to attach related records as additive source evidence and JSON summaries.

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
