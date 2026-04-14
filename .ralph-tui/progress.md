# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Ontology lifecycle orchestration belongs in an internal service that depends on `OntologyRegistryStore`; store adapters own persistence mutations, while sync to `PrefixRegistry` should use a narrow port and explicit service conflict types.
- Ontology service methods should keep validation and projection in the service layer, then call store writes only after local validation passes; tests can spy on operational-ontology facades and `OntologyRegistryStore.writeAllocationPlan()` to lock no-write failures.
- Reservation APIs over allocation policies should normalize `status: "reserved"` at the service boundary and keep raw `storeConflicts` while adding service-level allocation keys for callers.
- Allocation activation should complete service-level lifecycle and active `(prefix, versionId)` collision checks before calling the store status mutation; duplicate-active failures can reuse the structured `duplicate-allocation` payload with allocation keys.
- Deferred sync shells should validate service-owned lifecycle preconditions and return explicit report payloads, without accepting future adapter ports or writing external registries before the materialization phase.

---

## 2026-04-14 - US-005
- Implemented `syncToPrefixRegistry()` as an allocation precondition/report shell that accepts an allocation id or `{ allocationId }`, requires an active allocation, and returns a deferred Phase 4 sync report.
- Removed the Phase 3 PrefixRegistry write path from the ontology service and documented the deferred report shape for future index-meta materialization.
- Files changed:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts`
  - `docs/specs/operational-ontology/operational-ontology-index-meta-sync-handoff.spec.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Phase 3 should not accept a `PrefixRegistry` port in `syncToPrefixRegistry()` because that makes real sync behavior observable before Phase 4 owns materialization, idempotency, and schema-version checks.
  - Active allocation reports need only stable handoff coordinates: allocation id, prefix, version id, taxonomy id, status, and deferred sync status.
  - No-index-meta behavior is strongest when the service has no index-meta dependency in the sync path and tests verify an external `InMemoryPrefixRegistry` remains untouched.
---

## 2026-04-14 - US-004
- Implemented the remaining activation guard so `activateAllocation()` accepts object or allocation-id string input, requires `reserved`, checks for an existing active `(prefix, versionId)` owner, and only then updates status through `OntologyRegistryStore.updateAllocationStatus()`.
- Added activation tests for store-boundary mutation, no index-meta calls, missing allocation, active-again rejection, deprecated rejection, and duplicate-active collision rejection.
- Files changed:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Active allocation uniqueness belongs in the service activation path even though current persistence keeps `(prefix, versionId)` globally unique for reservations.
  - A duplicate-active activation failure should happen before `updateAllocationStatus()` so the reserved row remains unchanged.
  - `activateAllocation()` does not need any `PrefixRegistry` dependency; index-meta remains isolated to the explicit sync method.
---

## 2026-04-14 - US-003
- Implemented `reserveAddressSpace()` schema/allocation-policy input support in addition to the existing pack input path.
- Forced reservation writes to persist allocations with status `reserved`, even if an allocation policy supplies another status.
- Added structured duplicate allocation conflict keys for prefix/version and ontology/taxonomy/version while preserving raw store conflict details.
- Added service tests for schema-policy reservation, no index-meta writes during reservation, duplicate prefix/version conflict mapping, and duplicate ontology/taxonomy/version conflict mapping.
- Files changed:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `allocateOntologyAddressSpace()` accepts policy `status`, so a reserve-specific service must override it to avoid bypassing the explicit activation API.
  - Store conflict payloads already preserve the low-level collision reason; service callers also need normalized allocation keys to distinguish prefix/version from ontology/taxonomy/version conflicts without parsing messages.
  - `reserveAddressSpace(schema, policy)` can reuse the same projection/write helper as pack registration without pack validation, leaving schema issues to allocation-plan validation.
---

## 2026-04-14 - US-002
- Implemented pack registration as the full validation → allocation projection → allocation-plan validation → store persistence path.
- Added default `ontologyId = pack.packId` behavior with explicit registration option override support, while keeping `reserveAddressSpace()` delegated to the registration path.
- Added tests covering valid row persistence, explicit ontology id overrides, invalid pack no-write behavior, and invalid allocation plan no-write behavior.
- Files changed:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `allocateOntologyAddressSpace()` already returns a validation result, but the service should still call `validateOntologyAddressAllocationPlan()` explicitly before persistence to make the orchestration contract visible and testable.
  - `registerOntologyPack()` can support both object-style and direct `(pack, options)` calls without duplicating reservation logic; `reserveAddressSpace()` can delegate to it.
  - Invalid local inputs are easiest to prove as no-write failures by asserting `writeAllocationPlan()` was not called before checking store state.
---

## 2026-04-14 - US-001
- Implemented an internal ontology registry service boundary for pack validation, address-space reservation, allocation activation, and prefix-registry sync.
- Added allocation status transition support to the ontology registry store contract and both in-memory/SQL adapters.
- Added registry-service dependency on `operational-ontology` for pack validation and allocation projection.
- Files changed:
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.ts`
  - `packages/registry-service/src/modules/ontology/ontology-registry.service.test.ts`
  - `packages/registry-service/src/stores/ontology-registry-store.ts`
  - `packages/registry-service/src/stores/in-memory-ontology-registry-store.ts`
  - `packages/registry-service/src/stores/sql-ontology-registry-store.ts`
  - `packages/registry-service/src/stores/ontology-registry-store.test.ts`
  - `packages/registry-service/package.json`
  - `packages/registry-service/tsup.config.ts`
  - `pnpm-lock.yaml`
- **Learnings:**
  - `operational-ontology` already provides pack validation and allocation projection facades, so registry-service can stay orchestration-only.
  - Existing ontology store validation treats duplicate keys and drift as persistence-level conflicts; the service maps those into domain-level duplicate allocation conflicts.
  - `PrefixRegistry` sync should be idempotent for exact existing leaf records but fail with a sync precondition conflict when an existing prefix/version has different shape or capacity.
---
