# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Ontology lifecycle orchestration belongs in an internal service that depends on `OntologyRegistryStore`; store adapters own persistence mutations, while sync to `PrefixRegistry` should use a narrow port and explicit service conflict types.
- Ontology service methods should keep validation and projection in the service layer, then call store writes only after local validation passes; tests can spy on operational-ontology facades and `OntologyRegistryStore.writeAllocationPlan()` to lock no-write failures.

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
