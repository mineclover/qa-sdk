---
def:
  id: data-structure-profile-validation
  type: spec
  tier: system
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: data-structure-profile
  tags: [validation, diagnostics, quality-gate]
  links:
    - target: data-structure-profile-system
      type: refines
    - target: data-structure-profile-profile-contract
      type: depends_on
sources:
  - packages/data-structure-profile/src/validate.ts
  - packages/data-structure-profile/src/dpm.ts
  - packages/data-structure-profile/src/adapters.ts
  - packages/data-structure-profile/src/profile.test.ts
---

# Data Structure Profile Validation

## 목적 ^purpose

Validation layer는 profile fixture를 machine-readable gate evidence로 바꾼다. 목표는 설계 불확실성을 stable `dsp-*` diagnostics와 checked gate result로 노출하는 것이다.

## Status Semantics ^defines

- `pass`: error와 warning이 없다.
- `needs-review`: error는 없지만 warning이 하나 이상 있다.
- `fail`: error가 하나 이상 있다.

## Approved Diagnostic Surface ^defines

| Code | Severity source | Trigger |
|---|---|---|
| `dsp-taxonomy-ref-unknown` | error | taxonomy vocabulary lookup에 없는 source, structure, transform, quality risk ref |
| `dsp-profile-ref-unknown` | error | `structures[].parent`, `relationships[].from/to`, `transforms[].from/to`가 같은 profile의 source 또는 structure id를 참조하지 않음 |
| `dsp-quality-dedup-key-missing` | gate severity | `dedup` gate가 있는데 `source.event_id_path`가 없음 |
| `dsp-quality-replay-policy-missing` | gate severity | `replay` gate가 있는데 `source.replay_policy`가 없음 |
| `dsp-quality-schema-ref-missing` | gate severity | `schema-drift` gate가 있는데 `source.schema_ref`가 없음 |
| `dsp-transform-unbounded-array` | gate severity | `array-explosion` gate 대상 explode transform에 `max_array_length`가 없음 |
| `dsp-transform-array-threshold-exceeded` | gate severity | explode max array length가 configured threshold를 초과함 |
| `dsp-privacy-dpm-ref-missing` | privacy required flag | sensitive path가 있는데 `privacy.dpm_policy_ref`가 없음 |

## Gate Boundary ^constraint

- Unknown quality risk는 taxonomy validation을 통과하지 못하면 error가 된다.
- Profile graph references are profile-local. Cross-profile node reuse must happen through an explicit future registry or composition layer, not by placing another profile's node id in this profile.
- Known but unimplemented risk는 gate evidence path가 있으면 pass로 유지한다. 새 blocking behavior를 추가하려면 fixture와 expected report를 함께 갱신해야 한다.
- DPM readiness diagnostic은 validation report에도 합류하지만 DPM execution policy를 평가하지 않는다.
- `toQualityLedgerRunInputs`는 checked gate result를 consumer payload로 변환할 뿐, ledger history를 쓰지 않는다.

## 관련 소스

- `packages/data-structure-profile/src/validate.ts` — validation status, diagnostics, checked gate builder
- `packages/data-structure-profile/src/dpm.ts` — DPM readiness diagnostic source
- `packages/data-structure-profile/src/adapters.ts` — quality-ledger adapter payload conversion
- `packages/data-structure-profile/src/profile.test.ts` — fixture parity and diagnostic regression coverage
