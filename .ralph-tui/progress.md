# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- CLI-internal graph helpers should live under `packages/cli/src/lib/` when they are shared by commands but not intended as package API. For definition-catalog topology, accept `MemoryDefinitionRegistry` and/or `DefDataSource`-like inputs and keep command-specific ledger/status logic outside the helper.

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
