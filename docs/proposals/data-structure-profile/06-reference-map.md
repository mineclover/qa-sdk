---
def:
  id: data-structure-profile-06-reference-map
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
status: implemented
date: 2026-07-01
part_of: data-structure-profile
role: reference-map
supersedes: -
superseded_by: -
---

# Reference Map

## Purpose ^purpose

This document fixes how Data Structure Profile should lean on existing qa-sdk surfaces. The goal is
to inherit the taxonomy-engine philosophy without forcing profile-specific stream flattening,
measurement, and privacy-readiness semantics into packages that do not own them yet.

## 1. Reuse Depth Model ^defines

| Depth | Meaning | Default Rule |
|---|---|---|
| direct reuse | Data Structure Profile can call or depend on this surface in implementation. | Use for stable parse/validate/query primitives. |
| adapter bridge | Data Structure Profile emits a report that can be imported by this surface later. | Use when the target package owns evidence or measurement history. |
| reference only | Data Structure Profile follows the concept, but does not depend on the package. | Use while the profile contract is still draft. |
| defer | Keep out of MVP. | Use for live I/O, scheduling, and production privacy execution. |

## 2. Existing Surface Map ^context

| Existing Surface | Current Role | Reuse Depth | Data Structure Profile Use | Boundary |
|---|---|---:|---|---|
| `packages/taxonomy-engine` | YAML taxonomy parse/validate/diff/query/codegen and stable diagnostics | direct reuse | validate vocabulary axes, lifecycle, relation refs, and future taxonomy draft | does not own concrete JSONPath mapping or row multiplier math |
| `docs/taxonomies/ingest-coords.yaml` | dogfooded store-driver/store-kind/store-coverage taxonomy | reference only | model adapter capability and coverage patterns after an existing taxonomy | do not merge pipeline profile concepts into ingest service coordinate taxonomy |
| `packages/event-catalog` / `docs/specs/event-vocab-system/*` | event vocabulary, payload field guide, graph hints | reference only, later adapter bridge | reuse event naming and payload discipline for Kafka-like source events | does not become a Kafka payload schema registry in MVP |
| `packages/quality-ledger` | SQLite-backed gate execution result ledger | adapter bridge | import profile validation results after report shape stabilizes | profile validator owns `dsp-*` semantics; ledger records outcomes |
| `@qa-sdk/bench` | benchmark harness and markdown report renderer | adapter bridge | convert measurement dry-run output into benchmark-style evidence | bench should not own source-path parsing or transform semantics |
| `packages/viz-core`, `packages/viz-web`, `packages/registry-ui` | graph rendering and registry browsing surfaces | adapter bridge | consume deterministic lineage JSON for read-only inspection | editing/write-back stays out of MVP |
| `packages/definition-catalog` | definition metadata and coordinate-oriented catalog | reference only | preserve proposal/spec/decision evidence style | profile fixtures are not definition-catalog records yet |
| `packages/request-contract` (2026-10-29 삭제, git 이력 참고) | normalize input into contract, observe output, evaluate result | reference only | borrow the contract -> observation -> result mental model | no runtime dependency; data profiles are structural, not task requests |
| oa-sdk DPM docs/package | privacy manifest, pseudonymization policy, token/vault semantics | reference only, defer execution | store optional `dpm_policy_ref` and emit readiness diagnostics | no qa-sdk runtime dependency on oa-sdk in MVP |

## 3. Dependency Shape ^constraint

The intended implementation dependency shape is:

```text
taxonomy-engine
      ^
      |
data-structure-profile
      |
      +--> validation report JSON  --> quality-ledger adapter
      +--> measurement report JSON  --> bench adapter
      +--> lineage JSON             --> viz-core / viz-web / registry-ui
      +--> dpm_policy_ref string    --> oa-sdk DPM, out of process
```

Data Structure Profile should be able to parse and validate its fixture without `quality-ledger`,
`@qa-sdk/bench`, `viz-web`, `registry-ui`, or oa-sdk installed.

Current package spike:

- `toQualityLedgerRunInputs()` emits `quality-ledger` `recordRun()`-compatible objects.
- `toBenchReportInput()` emits a bench-compatible summary, title, and metadata object.
- Neither function imports `quality-ledger` or `@qa-sdk/bench`.
- `scripts/data-structure-profile-bridge-smoke.mjs` validates those adapter objects against the
  actual built `quality-ledger` and `@qa-sdk/bench` public APIs.

## 4. Practical Decisions ^decision-point

| Question | Decision |
|---|---|
| Should Kafka payload schema live in event-catalog now? | No. Keep schema fixtures profile-local until the event-catalog payload layer intentionally accepts source-event schemas. |
| Should quality-ledger define profile diagnostics? | No. Profile validator defines `dsp-*`; quality-ledger later records the run result. |
| Should bench calculate row multiplier? | No. Profile dry-run calculates it; bench can compare/report it later. |
| Should visualization define graph JSON? | No. Profile compiler emits stable lineage JSON; visualization consumes it. |
| Should DPM be a qa-sdk dependency? | No. Store string refs and readiness diagnostics only. |
| Should adapter capabilities be taxonomy entries or profile config? | Stable capability names belong in taxonomy; adapter-specific support matrix can remain profile config or a later adapter taxonomy. |

## 5. Implementation Guardrails ^constraint

1. The first package should parse a profile fixture and return plain JSON artifacts.
2. Direct package dependencies should start with taxonomy-engine only.
3. Ledger, bench, and visualization integrations should be adapters behind artifact files.
4. DPM integration should remain a string reference and diagnostic target.
5. Any live Kafka, ClickHouse, Spark, or dbt behavior should be deferred to a separate adapter proposal.

## 6. Current Fixture Anchor

The seed fixture pack is [fixtures/](./fixtures/). It fixes the first concrete case:

```text
Kafka-like commerce.orders event
  -> items array explode
  -> ClickHouse-like fact_order_items surface
  -> validation + measurement + DPM readiness snapshots
```

This fixture is not a runtime adapter. It is a stable contract for future parse/validate/compile
tests.
