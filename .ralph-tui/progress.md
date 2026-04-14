# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Ontology lifecycle orchestration belongs in an internal service that depends on `OntologyRegistryStore`; store adapters own persistence mutations, while sync to `PrefixRegistry` should use a narrow port and explicit service conflict types.

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
