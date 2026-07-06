---
def:
  id: data-structure-profile-system-future-work
  type: spec
  tier: system
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  svc: data-structure-profile
  tags: [todo, data-structure, profile]
  links:
    - target: data-structure-profile-system
      type: depends_on
    - target: data-structure-profile-operations-rule
      type: depends_on
sources:
  - docs/specs/data-structure-profile/data-structure-profile-system.spec.md
  - docs/specs/data-structure-profile/data-structure-profile-operations.rule.md
  - packages/data-structure-profile/package.json
  - packages/data-structure-profile/src/index.ts
  - packages/data-structure-profile/src/cli-runner.ts
  - packages/data-structure-profile/src/profile.test.ts
  - scripts/data-structure-profile-bridge-smoke.mjs
---

# Data Structure Profile Future Work

## 목적 ^purpose

이 todo는 approved spec baseline에 포함되지 않은 future scope만 남긴다. 현재 package와 fixtures로 검증된 계약은 `data-structure-profile-system.spec.md`와 자식 spec들이 소유하며, 이 문서는 현재 public surface에 섞으면 안 되는 deferred runtime/adapter 범위를 추적한다.

소스: `packages/data-structure-profile/src/index.ts`, `packages/data-structure-profile/src/cli-runner.ts`, `packages/data-structure-profile/src/profile.test.ts`, `scripts/data-structure-profile-bridge-smoke.mjs`

## Deferred Scope

- Production Kafka, CDC, ClickHouse, dbt, or stream scheduler adapters.
- ClickHouse migration generation or live materialized view management.
- DPM token vault execution, reversible pseudonymization, or policy authoring.
- Registry UI authoring workflow and writable profile editor.
- Schema registry integration beyond checked-in fixture schema refs.
- Measurement promotion from deterministic dry-run to live benchmark execution.

## Current Baseline Boundary

- `data-structure-profile` package owns fixture parsing, validation, lineage compilation, deterministic measurement dry-run, DPM readiness diagnostics, CLI runner, and adapter payload generation.
- `quality-ledger`, `@qa-sdk/bench`, and `viz-web` remain consumer/reference surfaces. Integration is proven by repo-level tests and smoke scripts, not by runtime dependencies inside `data-structure-profile`.
- Multiple profiles must stay isolated by profile id and profile-local graph references; cross-profile composition is deferred until a registry/composition layer exists.

## Entry Criteria

- Deferred work must identify whether it belongs in taxonomy vocabulary, profile artifact compilation, adapter bridge, or a future data-flow runtime.
- New vocabulary must pass the qa-sdk 5Q axis checklist before entering `docs/taxonomies/data-structure-profile.yaml`.
- New runtime dependency on consumer packages must be justified by an integration contract stronger than the current bridge smoke.
