# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Ontology/index-meta sync boundaries should live in `packages/registry-service/src/modules/ontology/` as type-first adapter contracts. Keep the service-facing report shell source-compatible, and narrow dependencies to `PrefixRegistry` plus schema-version store methods instead of index-meta table details.

---

## 2026-04-14 - US-001
- Added an ontology-scoped index-meta sync adapter contract with active allocation bundle input containing allocation, namespace, taxonomy, ordered axes, and segments.
- Defined sync report shapes for materialized, idempotent, repaired, collision, and deferred sum segment sidecar semantics while preserving the Phase 3 deferred report payload.
- Routed `OntologyRegistryService.syncToPrefixRegistry()` through the deferred report helper without adding REST routes, CLI commands, or index-meta writes.
- Files changed: `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`, `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - `OntologyRegistryService` intentionally owns active-allocation preconditions; the adapter boundary should receive an already active bundle rather than reloading ontology store rows.
  - `PrefixRegistry` is the correct index-meta boundary for prefix DAG records, while schema-version sync only needs `getSchemaVersion` and `insertSchemaVersion`.
  - TypeScript does not infer the active allocation intersection type from the service status guard, so the handoff call must make `status: "active"` explicit.
---
