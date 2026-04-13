# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- CLI-internal graph helpers should live under `packages/cli/src/lib/` when they are shared by commands but not intended as package API. For definition-catalog topology, accept `MemoryDefinitionRegistry` and/or `DefDataSource`-like inputs and keep command-specific ledger/status logic outside the helper.
- Quality-status artifact extraction keeps snapshot evidence, gate descriptor resolution, and governance closure concerns separate: record summaries can carry `gateDescriptors` plus structured warnings while prompt quality evidence derives refs/counts without changing the snapshot outcome policy.
- Optional quality-ledger inputs for prompt artifact extraction should stay explicit and artifact-source gated: validate/open only when `extract-artifact` is processing related quality-status records, emit structured warnings fail-open, and do not add automatic `.qa-sdk/quality-ledger.sqlite` lookup.

---

## 2026-04-14 - US-001
- Extracted shared CLI-internal quality gate topology helpers for recursive definition-catalog `contains` traversal and `GateDescriptor[]` conversion.
- Refactored `quality` export/bundle/claims paths to use the shared helper while preserving the previous graph version overlay behavior.
- Wired artifact extraction search fallback to expand quality-status target refs through the same contained-doc topology, without adding public package API or registry-service/index-meta reads.
- Added focused regression tests for recursive topology collection and descriptor conversion.
- Files changed:
  - `packages/cli/src/lib/quality-gate-topology.ts`
  - `packages/cli/src/commands/quality.ts`
  - `packages/cli/src/commands/quality.test.ts`
  - `packages/cli/src/commands/ontology.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Quality export previously collected recursive descendants from `MemoryDefinitionRegistry` with DFS over outgoing `contains`, then overlaid indexed gate versions before ledger verification.
  - Artifact extraction already treats quality-status evidence as sidecar governance context, so topology expansion must stay fail-open and avoid changing core extraction fallback behavior.
  - The previous graph traversal used version `0` before overlay; the helper exposes an explicit version override so command paths can preserve that behavior.
---

## 2026-04-14 - US-002
- Implemented quality-status gate descriptor resolution for artifact extraction, including snapshot/metadata/ref/relation priority, bundle expansion, direct-gate handling, descriptor output, prompt evidence gate refs, and `quality-status-ledger-no-gate-descriptors` warnings.
- Added CLI-internal data-source graph resolver coverage and ontology extraction regressions for snapshot-backed descriptors, metadata bundle descriptors, direct gate refs, relation refs, and no-descriptor warnings.
- Files changed:
  - `packages/cli/src/lib/quality-gate-topology.ts`
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/commands/ontology.test.ts`
  - `packages/cli/src/commands/quality.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Quality-status snapshot summaries are the best place to attach resolved `GateDescriptor[]` because the prompt-quality layer already consumes source summaries to derive `PromptArtifactQualityStatusEvidence`.
  - Bundle refs should expand through `contains` to all nested gate docs, while direct gate refs need `directGateOnly` handling so verification refs do not accidentally expand non-gate docs.
  - The existing scan data-source version path provides the same revision fallback shape used by quality export for scan-backed docs, so descriptor resolution can use `DefDoc.version` rather than introducing a new version policy.
---

## 2026-04-14 - US-003
- Added `--quality-ledger <path>` to `qa-sdk ontology prompt extract-artifact` usage and command descriptors without adding automatic local ledger lookup.
- Added explicit quality-ledger validation for artifact extraction quality-status evidence: missing paths emit `quality-status-ledger-missing`, unreadable/corrupt paths emit `quality-status-ledger-read-failed`, and extraction continues fail-open.
- Scoped ledger handling to artifact extraction paths, including file/definition fallbacks only when the internal artifact-source context is present; non-artifact prompt extraction ignores the flag.
- Added ontology CLI regressions for missing ledger, corrupt ledger, and non-artifact unchanged behavior.
- Files changed:
  - `packages/cli/src/commands/ontology.ts`
  - `packages/cli/src/commands/ontology.test.ts`
  - `packages/cli/src/command-groups/ontology.commands.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `parseArtifactExtractionSource(flags)` is the existing internal boundary marker for artifact fallback flows that reuse non-artifact prompt commands.
  - `SqliteQualityStore` creates/migrates databases when opened, so explicit ledger loading must check `existsSync` first to avoid creating a missing fallback DB.
  - Ledger path failures fit the same source warning channel as snapshot and descriptor warnings, preserving snapshot-only closure policy until ledger-derived fallback evidence is implemented separately.
---
