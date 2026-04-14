# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Ontology/index-meta sync boundaries should live in `packages/registry-service/src/modules/ontology/` as type-first adapter contracts. Keep the service-facing report shell source-compatible, and narrow dependencies to `PrefixRegistry` plus schema-version store methods instead of index-meta table details.
- Active ontology sync bundles must reorder store-loaded axis rows by `taxonomy.axisIds`; store adapters return axis rows in stable storage order, not necessarily taxonomy order.
- Product ontology index-meta sync should build the full intended prefix/schema target set, validate product segment shape and parent capacity math, then preflight existing records before any write. Matching records are idempotent, missing counterparts can be repaired, and capacity/refs drift blocks without overwrite.
- Sum ontology index-meta sync should materialize only the allocation prefix/schema as a leaf target, validate exact sidecar segment coverage before any write, and keep sum segments as report-only metadata rather than `prefix_ref` rows until index-meta owns a segment model.

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

## 2026-04-14 - US-003
- Implemented product allocation materialization in the ontology index-meta sync adapter: namespace-scoped axis leaf prefix derivation, axis leaf prefix/schema records, composite allocation prefix refs in taxonomy `axisIds` order, parent capacity/product checks, product segment shape validation, idempotent reruns, partial repair reporting, and drift blocking without overwrite.
- Wired `OntologyModule` to provide the real sync adapter with `SqlPrefixRegistry` plus `SqlIndexMetaStore` schema-version methods, while plain service construction still uses the deferred adapter fallback.
- Added focused registry-service adapter tests for product materialization, idempotency, capacity drift, refs drift, schema-version drift, and segment/capacity shape blocking.
- Files changed: `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`, `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.test.ts`, `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`, `packages/registry-service/src/modules/ontology/ontology.module.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Axis leaf prefixes need a documented deterministic derivation independent of store order; using normalized namespace plus axis id keeps shared taxonomy axes reusable while preserving global prefix collision checks.
  - Prefix/schema sync must be shape-idempotent rather than upsert-based: compare capacity and ordered refs first, then write only missing records.
  - Product segment records remain registry-service evidence, not index-meta rows; the adapter uses them to validate the composite parent shape before writing any prefix registry record.
---

## 2026-04-14 - US-004
- Verified the existing ontology index-meta sync adapter writes schema version records alongside every product allocation prefix registry target.
- Added regression coverage proving both axis leaf schema versions are written, the allocation prefix schema version is written, capacities match the intended prefix registry shape, and matching partial prefix/schema rows are repaired without overwriting drift.
- Ran the full acceptance checklist for registry-service, index-meta, operational-ontology allocation tests, and definition validation.
- Files changed: `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - US-003 already implemented the production schema-version write path; US-004 needed explicit coverage for all materialized schema rows and both safe partial-repair directions.
  - `def validate` can fail transiently if it is run while `index-meta` build is cleaning `dist/`; rerun it after the package build completes.
---

## 2026-04-14 - US-005
- Implemented sum allocation materialization in the ontology index-meta sync adapter: allocation prefix/version now writes as a leaf `PrefixRegistryRecord`, matching `schema_version` is written, and segment data is preserved as report sidecar metadata with `coveragePolicy: "exact-allocation-range"`.
- Added exact segment sidecar validation for range containment, no overlap, no gaps/trailing gaps, positive integer segment ranges, non-empty consumes, and allocation capacity/addressSize drift before any prefix or schema write.
- Added regression coverage for sum leaf sync, no `prefix_ref` deps, sidecar report payload, idempotent rerun, coverage drift blockers, and capacity drift blockers.
- Ran the full acceptance checklist for registry-service, index-meta, operational-ontology allocation tests, and definition validation.
- Files changed: `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`, `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The existing prefix/schema target preflight and write machinery can be shared by product and sum planners when the planner returns a common target set plus optional deferred sidecar semantics.
  - `PrefixRegistryRecord.refs` absence is the safest representation for sum allocations today; `getDeps()` stays empty and `getShape()` returns `[capacity]`, matching the handoff smoke contract.
  - Sum sidecar metadata should be emitted on both fresh and idempotent sync reports because it is audit/report state, not a persisted index-meta row.
---
