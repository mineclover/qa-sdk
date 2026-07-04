---
def:
  id: data-structure-profile-system
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
---

# Data Structure Profile Future Work

## 목적 ^purpose

이 todo는 approved spec baseline에 포함되지 않은 future scope만 남긴다. 현재 package와 fixtures로 검증된 계약은 `data-structure-profile-system.spec.md`와 자식 spec들이 소유한다.

## Deferred Scope

- Production Kafka, CDC, ClickHouse, dbt, or stream scheduler adapters.
- ClickHouse migration generation or live materialized view management.
- DPM token vault execution, reversible pseudonymization, or policy authoring.
- Registry UI authoring workflow and writable profile editor.
- Schema registry integration beyond checked-in fixture schema refs.
- Measurement promotion from deterministic dry-run to live benchmark execution.

## Entry Criteria

- Deferred work must identify whether it belongs in taxonomy vocabulary, profile artifact compilation, adapter bridge, or a future data-flow runtime.
- New vocabulary must pass the qa-sdk 5Q axis checklist before entering `docs/taxonomies/data-structure-profile.yaml`.
- New runtime dependency on consumer packages must be justified by an integration contract stronger than the current bridge smoke.
