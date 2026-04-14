# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Phase 4 ontology/index-meta sync drift checks must be limited to the current persisted index-meta target surface: prefix capacity, ordered refs, schema-version capacity, and sum sidecar coverage. Axis `valuesHash` reproduction belongs to future axis-value entry materialization, not current prefix/schema sync.
- Ontology activation orchestration should live as an ontology module helper/provider that calls `OntologyRegistryService` methods (`registerOntologyPack`, `activateAllocation`, `syncToPrefixRegistry`) and returns namespace/allocation/sync/warning/error payloads without reaching into stores or SQL.
- Valid pack activation is an all-allocation path: `registerOntologyPack` validates before reservation, then the helper activates and syncs every returned allocation instead of selecting a subset.

---

## 2026-04-14 - US-001
- Reviewed Phase 4 sync adapter implementation/tests against `operational-ontology-index-meta-sync-handoff.spec.md`.
- Updated the handoff contract so axis leaf sync detects persisted capacity/refs/schema drift only; `valuesHash` reproduction is documented as future axis-value entry materialization behavior because index-meta does not currently persist axis values or hashes.
- Confirmed Phase 4 report fields are sufficient for Phase 5 smoke checks over the current materialization surface: registry-service active status, `targetRecords[]`, product shape/resolver checks, and sum sidecar coverage.
- Files changed: `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md`, `.ralph-tui/progress.md`.
- **Learnings:**
  - `PrefixRegistryRecord` and `schema_version` carry prefix/version/capacity and ordered refs; they do not carry ontology axis `valuesHash`.
  - The adapter tests already cover capacity drift, refs drift, schema-version capacity drift, product resolver bounds, and sum sidecar exact coverage, which are the Phase 5 smoke inputs available today.
  - The completed Phase 4 PRD JSON was left untouched.
---

## 2026-04-14 - US-002
- Added an internal `OntologyPackActivationHelper` boundary with `activateOntologyPack(pack, options)` and a function-level service-port helper for direct orchestration tests.
- Defined activation options for ontology id, namespace, owner, version id, address model, axis/taxonomy capacity overrides, taxonomy prefix overrides, and timestamp-to-`now` mapping.
- Defined activation result payload fields for pack id, ontology id, namespace record, final allocations, allocation activation statuses, sync reports, warnings, and errors.
- Wired the helper into `OntologyModule` as an exported provider without adding REST routes or CLI commands.
- Added tests proving the helper calls only `OntologyRegistryService` methods and can drive a real in-memory registry/index-meta activation path.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`, `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `packages/registry-service/src/modules/ontology/ontology.module.ts`, `packages/registry-service/src/modules/ontology/ontology.module.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - `registerOntologyPack` already validates the pack, reserves address space, and returns the namespace plus reserved allocation records needed by an activation helper.
  - A helper can keep the orchestration boundary narrow by treating `OntologyRegistryService` as a port with only `registerOntologyPack`, `activateAllocation`, and `syncToPrefixRegistry`.
  - Phase 4 sync reports already carry the post-sync surface the activation payload can forward; smoke-specific assertions can be layered onto this payload in later stories.
---

## 2026-04-14 - US-003
- Added acceptance-level coverage for a valid multi-allocation pack activation path through `OntologyPackActivationHelper`.
- Verified pack validation is called before address-space reservation/allocation planning, then namespace, axis, taxonomy, allocation, and segment rows are written.
- Verified every intended allocation moves from `reserved` to `active`, every activated allocation calls index-meta sync, and the activation result reports allocation id, prefix, version id, active status, and synced status.
- Verified synced allocation prefix registry records and schema version records exist for each activated allocation.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The existing helper already implements the deterministic all-allocation policy by iterating over `registration.allocations`; US-003 needed stronger evidence across more than one taxonomy.
  - `OntologyRegistryService.registerOntologyPack` owns pack validation ordering, so helper-level tests can prove validation-before-reservation with spies on the operational ontology pack and allocation planes.
  - Product allocation sync materializes both allocation prefix records and schema version records; future smoke stories can reuse the same stores to add resolver and sidecar assertions.
---
