# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Ontology/index-meta sync boundaries should live in `packages/registry-service/src/modules/ontology/` as type-first adapter contracts. Keep the service-facing report shell source-compatible, and narrow dependencies to `PrefixRegistry` plus schema-version store methods instead of index-meta table details.
- Active ontology sync bundles must reorder store-loaded axis rows by `taxonomy.axisIds`; store adapters return axis rows in stable storage order, not necessarily taxonomy order.

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

## 2026-04-14 - US-002
- `OntologyRegistryService.syncToPrefixRegistry()` now collects a complete active allocation bundle from `OntologyRegistryStore` before delegating to the ontology sync adapter boundary.
- Added structured sync precondition failures for missing namespace, taxonomy, required axis, and segment rows while preserving missing-allocation and non-active allocation behavior.
- Added tests proving taxonomy `axisIds` order is preserved in the bundle and segment `consumes`, `addressOffset`, and `addressSize` are passed through unchanged.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`, `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`, `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The existing store list methods are sufficient for bundle collection; no index-meta table details need to enter `OntologyRegistryService`.
  - Store adapters sort axes by storage key, so service-level bundle assembly must build an axis map and project it through `taxonomy.axisIds` to preserve decode shape.
  - A default deferred sync adapter lets the service exercise the same bundle boundary now while keeping the Phase 3 report payload compatible until real materialization lands.
---
