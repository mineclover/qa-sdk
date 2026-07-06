---
def:
  id: data-structure-profile-04-validation-and-diagnostics
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  sources:
    - docs/specs/data-structure-profile/data-structure-profile-validation.spec.md
    - docs/specs/data-structure-profile/data-structure-profile-system.test.md
    - packages/data-structure-profile/src/validate.ts
    - packages/data-structure-profile/src/dpm.ts
    - packages/data-structure-profile/src/adapters.ts
    - packages/data-structure-profile/src/cli-runner.ts
    - packages/data-structure-profile/src/profile.test.ts
    - packages/data-structure-profile/src/cli-runner.test.ts
    - docs/proposals/data-structure-profile/fixtures/expected-validation-report.json
    - docs/proposals/data-structure-profile/fixtures/expected-customer-orders-validation-report.json
    - scripts/data-structure-profile-bridge-smoke.mjs
status: implemented
date: 2026-07-01
part_of: data-structure-profile
role: validation-and-diagnostics
supersedes: -
superseded_by: -
---

# Validation And Diagnostics

## Purpose ^purpose

Data Structure Profile validation should turn design uncertainty into stable, machine-readable
diagnostics. The goal is not to prove a live pipeline works. The goal is to prove that the declared
structure can be reasoned about before implementation.

## 1. Validation Layers

| Layer | Scope | Failure Mode |
|---|---|---|
| parse | YAML syntax and required sections | fail-fast |
| structural | profile refs, ids, source/target shape | fail-collect |
| taxonomy | referenced kinds exist in taxonomy | fail-collect |
| transform | from/to structures and transform semantics are valid | fail-collect |
| measurement | required assumptions exist and estimates are bounded | fail-collect |
| quality | dedup/replay/schema drift risks have gates | fail-collect |
| privacy | sensitive paths have DPM readiness decision | warning by default |

## 2. Diagnostic Prefixes

Profile diagnostics should not reuse taxonomy-engine core codes.

| Prefix | Meaning | Example |
|---|---|---|
| `dsp-parse-*` | profile syntax or required field problem | `dsp-parse-missing-source` |
| `dsp-profile-*` | profile-local graph reference problem | `dsp-profile-ref-unknown` |
| `dsp-taxonomy-*` | taxonomy reference problem | `dsp-taxonomy-ref-unknown` |
| `dsp-transform-*` | transform graph or bound problem | `dsp-transform-unbounded-array` |
| `dsp-measure-*` | measurement assumption/report problem | reserved for future measurement diagnostics |
| `dsp-quality-*` | quality gate problem | `dsp-quality-dedup-key-missing` |
| `dsp-privacy-*` | DPM readiness problem | `dsp-privacy-dpm-ref-missing` |

## 3. Implemented MVP Diagnostics

| Code | Severity | When |
|---|---|---|
| `dsp-taxonomy-ref-unknown` | error | source, structure, transform, or quality risk kind is not in the taxonomy vocabulary. |
| `dsp-profile-ref-unknown` | error | structure parent, relationship endpoint, or transform endpoint is not local to the same profile. |
| `dsp-quality-dedup-key-missing` | gate severity | `dedup` gate exists but `source.event_id_path` is missing. |
| `dsp-quality-replay-policy-missing` | warning | stream source has no replay/backfill policy. |
| `dsp-quality-schema-ref-missing` | gate severity | `schema-drift` gate exists but `source.schema_ref` is missing. |
| `dsp-transform-unbounded-array` | gate severity | explode transform has no `max_array_length` bound. |
| `dsp-transform-array-threshold-exceeded` | gate severity | explode transform bound exceeds configured threshold. |
| `dsp-privacy-dpm-ref-missing` | privacy required flag | sensitive paths exist without DPM policy ref. |

## 4. Quality Gates

MVP quality gates:

| Gate | Required Evidence |
|---|---|
| dedup | event id path or explicit dedup key |
| replay | replay/backfill policy note or disabled reason |
| schema drift | schema ref and drift handling mode |
| array explosion | average/max array length and threshold |
| relationship break | relationship-sensitive field mapping or DPM ref |
| PII leak | sensitive path list and DPM readiness decision |

## 5. Severity Policy

Default severity:

- errors block compile output;
- warnings allow compile output but mark report as `needs-review`;
- infos record non-blocking evidence.

Privacy readiness starts as warning because the profile layer must remain useful without oa-sdk.
If a profile declares `privacy.required: true`, missing DPM policy reference becomes error.

## 6. Report Shape

```json
{
  "kind": "data-structure-profile.validation-report.v1",
  "profile": "order-events-to-order-item-facts",
  "summary": {
    "errors": 0,
    "warnings": 2,
    "infos": 0
  },
  "diagnostics": [
    {
      "code": "dsp-quality-replay-policy-missing",
      "severity": "warning",
      "ref": "profile#/source",
      "message": "Stream source has no replay/backfill policy."
    }
  ]
}
```

## 7. Ledger Integration

quality-ledger integration should wait until report shape stabilizes.

Initial bridge fields:

- `profileId`
- `profileVersion`
- `gateId`
- `diagnosticCode`
- `severity`
- `status`
- `evidenceRef`
- `createdAt`

The ledger should store outcomes, not own validation semantics.

## 8. Current Source-Backed Boundary ^evidence

- `validateProfile` emits `pass`, `needs-review`, and `fail` status from stable diagnostic severity counts.
- Local graph references are profile-local; attempts to point one profile at another profile's node id fail with `dsp-profile-ref-unknown`.
- Taxonomy validation uses `parseProfileTaxonomy` vocabulary membership and fails unknown refs with `dsp-taxonomy-ref-unknown`.
- `toQualityLedgerRunInputs` and `toBenchReportInput` convert reports into consumer payloads; they do not write ledger history or run benchmarks themselves.
- `scripts/data-structure-profile-bridge-smoke.mjs` proves the built consumer packages can consume those payloads without adding `quality-ledger` or `@qa-sdk/bench` as runtime dependencies of `data-structure-profile`.
