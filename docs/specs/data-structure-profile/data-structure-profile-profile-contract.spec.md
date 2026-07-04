---
def:
  id: data-structure-profile-profile-contract
  type: spec
  tier: interface
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: domain
  svc: data-structure-profile
  tags: [contract, artifact, lineage, measurement]
  links:
    - target: data-structure-profile-system
      type: refines
    - target: data-structure-profile-taxonomy
      type: depends_on
  sources:
    - packages/data-structure-profile/src/types.ts
    - packages/data-structure-profile/src/parse.ts
    - packages/data-structure-profile/src/lineage.ts
    - packages/data-structure-profile/src/measurement.ts
    - packages/data-structure-profile/src/dpm.ts
    - packages/data-structure-profile/src/adapters.ts
---

# Data Structure Profile Contract

## 목적 ^purpose

Profile contract는 checked-in YAML profile을 stable JSON artifacts로 바꾸는 소비 계약이다. 구현된 타입과 함수 시그니처는 package source가 SSOT이고, 이 문서는 artifact 책임과 boundary를 고정한다.

## Profile Input ^defines

Profile YAML은 named source, concrete structures, relationships, transforms, measurement assumptions, quality gates, optional privacy readiness config를 담는다.

- `source.kind`, `structures[].kind`, `transforms[].kind`, `quality_gates[].risk`는 taxonomy vocabulary entry를 참조한다.
- `source.ref`, `source_path`, `target_ref`, transform id, gate id는 profile-local concrete artifact다.
- missing optional arrays or maps are normalized by `parseProfile` into empty collections or default version.

## Derived Artifacts ^defines

| Artifact kind | Owner source | 책임 |
|---|---|---|
| `data-structure-profile.validation-report.v1` | `validateProfile` | taxonomy ref check, quality gate result, DPM readiness diagnostics |
| `data-structure-profile.compiled.v1` | `compileLineage` | source, structures, transforms, output nodes, deterministic lineage edges, diagnostic target map |
| `data-structure-profile.measurement-report.v1` | `measureProfile` | event rate, payload size, array length, row multiplier, output throughput dry-run |
| `data-structure-profile.dpm-readiness.v1` | `assessDpmReadiness` | sensitive path normalization and missing DPM policy diagnostic |
| quality-ledger adapter payload | `toQualityLedgerRunInputs` | validation checked gates to `recordRun`-compatible input |
| bench adapter payload | `toBenchReportInput` | measurement dry-run to report-renderer-compatible input |

## Contract Boundaries ^constraint

- Artifact compilation must be deterministic for checked-in fixtures.
- Adapter payloads must remain plain JSON-compatible values and must not require `quality-ledger` or `@qa-sdk/bench` as runtime dependencies of `data-structure-profile`.
- Measurement is a deterministic dry-run, not a live benchmark execution.
- DPM readiness only reports policy reference presence and sensitive path shape; privacy execution belongs to DPM.

## 관련 소스

- `packages/data-structure-profile/src/types.ts` — implemented TypeScript artifact and profile types
- `packages/data-structure-profile/src/parse.ts` — YAML parser and default normalization
- `packages/data-structure-profile/src/lineage.ts` — compiled lineage artifact builder
- `packages/data-structure-profile/src/measurement.ts` — dry-run measurement artifact builder
- `packages/data-structure-profile/src/dpm.ts` — optional DPM readiness artifact builder
- `packages/data-structure-profile/src/adapters.ts` — quality-ledger and bench adapter payload builders
