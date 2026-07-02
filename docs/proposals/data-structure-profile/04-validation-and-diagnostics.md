---
def:
  id: data-structure-profile-04-validation-and-diagnostics
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
status: under-review
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
| `dsp-struct-*` | structure id/path/parent problem | `dsp-struct-broken-parent` |
| `dsp-tax-*` | taxonomy reference problem | `dsp-tax-unknown-kind` |
| `dsp-transform-*` | transform graph problem | `dsp-transform-broken-input` |
| `dsp-measure-*` | measurement assumption/report problem | `dsp-measure-unbounded-row-multiplier` |
| `dsp-quality-*` | quality gate problem | `dsp-quality-dedup-missing` |
| `dsp-privacy-*` | DPM readiness problem | `dsp-privacy-dpm-ref-missing` |

## 3. Required MVP Diagnostics

| Code | Severity | When |
|---|---|---|
| `dsp-parse-missing-source` | error | `source` section is absent. |
| `dsp-struct-duplicate-id` | error | structure or transform ids collide. |
| `dsp-struct-broken-parent` | error | structure parent does not exist. |
| `dsp-tax-unknown-kind` | error | kind is not in the taxonomy vocabulary. |
| `dsp-transform-broken-input` | error | transform `from` structure does not exist. |
| `dsp-transform-broken-output` | error | transform `to` structure does not exist. |
| `dsp-measure-array-length-missing` | warning | explode transform exists but average array length is missing. |
| `dsp-measure-unbounded-row-multiplier` | warning | max array length is missing or above configured budget. |
| `dsp-quality-dedup-missing` | error | stream source has no event id or dedup gate. |
| `dsp-quality-replay-policy-missing` | warning | stream source has no replay/backfill policy. |
| `dsp-quality-schema-drift-policy-missing` | warning | schema ref exists but no schema drift gate exists. |
| `dsp-privacy-dpm-ref-missing` | warning | sensitive paths exist without DPM policy ref. |

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
