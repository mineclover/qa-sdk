# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Phase 4 ontology/index-meta sync drift checks must be limited to the current persisted index-meta target surface: prefix capacity, ordered refs, schema-version capacity, and sum sidecar coverage. Axis `valuesHash` reproduction belongs to future axis-value entry materialization, not current prefix/schema sync.
- Ontology activation orchestration should live as an ontology module helper/provider that calls `OntologyRegistryService` methods (`registerOntologyPack`, `activateAllocation`, `syncToPrefixRegistry`) and returns namespace/allocation/sync/warning/error payloads without reaching into stores or SQL.
- Valid pack activation is an all-allocation path: `registerOntologyPack` validates before reservation, then the helper activates and syncs every returned allocation instead of selecting a subset.
- Activation-level smoke checks should be assembled from `syncToPrefixRegistry` post-sync reports plus activated allocation status; the helper should not reach into prefix registry stores or SQL directly.
- Sum activation smoke checks should assert leaf prefix/schema capacity and `postSyncChecks.sumAllocation` sidecar coverage only; do not reuse product shape/resolver checks for sum segments.
- Activation no-write coverage should exercise `OntologyPackActivationHelper` through real `OntologyRegistryService` instances and a memory/SQL backend matrix, while asserting registry rows through store APIs and SQL index-meta rows through table counts.
- Activation blocked-sync coverage should assert existing index-meta records remain unchanged through store readbacks and SQL table counts; composite prefix drift can legitimately return both capacity and refs drift, so tests should require the relevant collision with `arrayContaining` rather than exact singleton arrays.
- Activation result payloads should keep raw registry/sync reports for internal detail while also exposing derived API/CLI summaries (`namespaceSummary`, `allocationSummaries`, `syncSummariesByAllocationId`, `smokeCheckSummary`) so public consumers do not need to infer grouping or counts.

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

## 2026-04-14 - US-004
- Added product activation smoke check payloads to `OntologyPackActivationResult`.
- Product smoke checks now assert active source allocation status, intended product prefix record readback, schema-version/prefix capacity agreement, ordered product shape, last valid resolver bounds, and capacity out-of-range resolver bounds.
- Extended index-meta post-sync target checks to report intended prefix record and ordered-ref match status.
- Added activation helper coverage proving product allocations return passing smoke checks after valid pack activation, while sum activation remains out of scope for US-004.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`, `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `packages/registry-service/src/modules/ontology/index-meta-sync.adapter.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The activation helper can treat Phase 4 sync reports as the readback authority and compose smoke assertions without expanding its service-port boundary.
  - `targetRecords[]` needed an explicit `prefixRegistryRecordMatchesIntended` flag because capacity-only readback did not prove product prefix refs matched the intended composite record.
  - `pnpm --filter registry-service test -- ontology-activation.helper` still runs the full registry-service suite in this package, so exact acceptance commands were rerun separately.
---

## 2026-04-14 - US-005
- Added sum activation smoke checks to `OntologyPackActivationResult`.
- Sum smoke checks now assert active source allocation status, intended sum leaf prefix record readback, schema-version capacity matching the sum allocation capacity, and exact-allocation-range sidecar coverage.
- Updated activation helper tests so sum activation payloads expose only sum leaf/sidecar assertions and do not claim product shape or resolver decode semantics.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`, `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - `syncToPrefixRegistry` already provides the complete sum smoke surface through the allocation `targetRecords[]` entry plus `postSyncChecks.sumAllocation`.
  - Sum allocation prefix registry records are leaf records: intended readback has capacity and no refs, while segment ranges remain report sidecars under `exact-allocation-range`.
  - Product resolver and shape checks must remain product-only; sum segments currently have explicit sidecar semantics, not product DAG decode semantics.
---

## 2026-04-14 - US-006
- Added acceptance-level invalid activation no-write coverage for `OntologyPackActivationHelper`.
- Invalid pack activation now has tests proving a structured `invalid-pack` register-phase error, no allocation activation/sync payloads, no registry-service writes, and no index-meta writes.
- Invalid allocation-plan activation now has tests proving a structured `invalid-allocation-plan` register-phase error for duplicate prefix/version plans, with no namespace/axis/taxonomy/allocation/segment rows and no prefix registry/schema-version rows.
- Covered both in-memory and SQLite-backed registry-service/index-meta stores where practical; SQL cases also assert raw backing table counts for registry-service and index-meta tables.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - `OntologyRegistryService.registerOntologyPack` already owns the safe ordering: pack validation, allocation planning, allocation-plan validation, then store write. The helper only needs to surface the structured error and stop.
  - `writeAllocationPlan` is not called for local invalid allocation-plan validation failures, so invalid activation retries leave no registry rows before SQL transactions are involved.
  - `index-meta` has `PrefixRegistry.listAll()` for memory/SQL prefix checks, but schema-version emptiness is best proven by known target readbacks for memory and raw `schema_version` counts for SQL.
  - Running the full registry-service suite concurrently with package builds/index-meta tests can push dashboard tests past their 5s timeout; rerunning `pnpm --filter registry-service test` alone passed.
---

## 2026-04-14 - US-007
- Proved duplicate active prefix/version activation is blocked before allocation status updates and before index-meta sync writes.
- Added activation helper matrix coverage for mismatched existing prefix registry records and mismatched schema version capacity, asserting blocked sync errors and unchanged index-meta rows.
- Enriched activation helper issue payloads with allocation taxonomy, prefix, and version when activate/sync/smoke context is available.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`, `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - `OntologyRegistryService.activateAllocation` already owns the active allocation uniqueness gate through `listActiveAllocations()` before `updateAllocationStatus()`.
  - `OntologyIndexMetaSyncAdapter` preflights all target prefix/schema records before writing, so one drifted allocation prefix blocks axis leaf materialization and schema repair too.
  - Product prefix drift can emit both `prefix-capacity-drift` and `prefix-refs-drift` when the existing record is a leaf but the intended record is composite.
---

## 2026-04-14 - US-008
- Added activation result summary payload fields for namespace records, allocation records plus activation/sync status, sync summaries grouped by allocation id, and aggregate smoke check counts.
- Added payload-shape tests on the successful multi-allocation activation path so future API/CLI surfaces can expose activation without reconstructing shape from raw sync reports.
- Added sanitized unexpected sync failure coverage proving the result preserves structured phase/allocation context while not exposing raw SQLite/SQL text.
- Files changed: `packages/registry-service/src/modules/ontology/ontology-activation.helper.ts`, `packages/registry-service/src/modules/ontology/ontology-activation.helper.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - The helper can add API-oriented summaries without weakening the existing detailed `namespaceRecord`, `allocations`, `activationStatuses`, `syncReports`, and `smokeChecks` payloads.
  - Success payload assertions are most useful on the multi-allocation path because they prove `syncSummariesByAllocationId` grouping instead of just a single report mirror.
  - Unknown infrastructure failures should be converted to generic activation issues with `phase`, code, allocation identifiers, and error name only; raw SQL strings stay out of the payload.
---

## 2026-04-14 - US-009
- Reflected Phase 5 activation smoke completion in the registry allocation TODO, including helper flow, product/sum smoke scope, no-write coverage, result payload summaries, and final verification commands.
- Updated the registry allocation spec with `OntologyPackActivationHelper` as the completed Phase 5 surface, documenting its service-port-only orchestration, all-allocation activation path, product/sum smoke responsibilities, and raw-plus-summary result payload.
- Updated the index-meta sync handoff to clarify that the sync adapter owns post-sync readbacks while the activation helper owns activation-level smoke assembly and must not query stores or SQL directly.
- Updated the lifecycle master PRD so Phase 5 is final and Phase 6 remains policy-only unless a scoped-prefix decision PRD is created.
- Files changed: `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`, `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md`, `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md`, `tasks/prd-ontology-registry-allocation-lifecycle-master.md`, `.ralph-tui/progress.md`.
- Verification passed: `pnpm --filter registry-service test`, `pnpm --filter registry-service typecheck`, `pnpm --filter registry-service build`, `pnpm --filter index-meta test`, `pnpm --filter index-meta typecheck`, `pnpm --filter index-meta build`, `pnpm --filter operational-ontology test -- allocation`, `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - The completed Phase 5 docs should describe activation as helper-level orchestration over `OntologyRegistryService`, while keeping Phase 4 sync responsible only for materialization reports and post-sync readbacks.
  - Public activation consumers should be pointed at derived summaries instead of requiring them to infer grouping from raw registry and sync reports.
  - Scoped prefix remains explicitly outside this lifecycle; reopening it needs the scoped-prefix decision gate plus a new PRD/ADR.
---
