---
def:
  id: data-structure-profile-03-profile-layer
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
status: draft
date: 2026-07-01
part_of: data-structure-profile
role: profile-layer
supersedes: -
superseded_by: -
---

# Profile Layer

## Purpose ^purpose

The profile layer describes concrete data-structure flow instances. It references taxonomy
vocabulary, but owns source paths, target refs, transform instances, measurement assumptions,
quality gates, and derived lineage artifacts.

## 1. Profile Boundary ^decision-point

A profile is appropriate when the data structure has a named source, concrete paths, and a target
surface that can be validated or measured.

Examples:

- Kafka order event -> ClickHouse order item fact table.
- PostgreSQL customer/orders tables -> pseudonymized analysis dataset.
- CDC event envelope -> normalized event audit table.

Not examples:

- The word `kafka` as a source kind. That is taxonomy.
- A live Kafka consumer deployment. That is future adapter/runtime.
- Token vault behavior. That is DPM.

## 2. YAML Shape

The concrete seed fixture lives at
[fixtures/order-events.profile.yaml](./fixtures/order-events.profile.yaml). The shape below is the
minimal contract that fixture should continue to exercise.

```yaml
profile: order-events-to-order-item-facts
version: 1
taxonomy_ref: data-structure-profile@1

source:
  id: commerce-orders-topic
  kind: kafka
  ref: commerce.orders
  payload_format: json
  event_id_path: $.event_id
  event_time_path: $.occurred_at
  schema_ref: fixtures/order-event.schema.json

structures:
  - id: order-event
    kind: event
    source_path: $
    lifecycle: approved
  - id: order-id
    kind: field
    source_path: $.order_id
    parent: order-event
  - id: item-array
    kind: array
    source_path: $.items[*]
    parent: order-event
  - id: order-item-fact
    kind: fact
    target_ref: clickhouse.fact_order_items

transforms:
  - id: explode-items
    kind: explode
    from: item-array
    to: order-item-fact
    semantics:
      empty_array: left-empty-row
      max_array_length: 200
      output_grain: one-row-per-item

measurements:
  expected_event_rate_per_sec: 1000
  average_payload_bytes: 2048
  average_array_length: 5
  max_array_length: 200

quality_gates:
  - id: event-id-dedup-required
    risk: dedup
    severity: error
    evidence:
      path: $.event_id
  - id: array-explosion-budget
    risk: array-explosion
    severity: error
    threshold:
      max_array_length: 200

privacy:
  dpm_policy_ref: optional
  sensitive_paths:
    - $.customer_no
  required_when:
    - pii-leak
    - relationship-break
```

## 3. Compile Output

The profile compiler should produce deterministic artifacts.

```json
{
  "kind": "data-structure-profile.compiled.v1",
  "profile": "order-events-to-order-item-facts",
  "lineage": {
    "nodes": [
      { "id": "commerce-orders-topic", "kind": "source" },
      { "id": "item-array", "kind": "array" },
      { "id": "explode-items", "kind": "transform" },
      { "id": "order-item-fact", "kind": "fact" }
    ],
    "edges": [
      { "from": "commerce-orders-topic", "to": "item-array", "kind": "contains" },
      { "from": "item-array", "to": "explode-items", "kind": "input" },
      { "from": "explode-items", "to": "order-item-fact", "kind": "produces" }
    ]
  }
}
```

## 4. Measurement Output

The first dry-run report should be intentionally small.

```json
{
  "kind": "data-structure-profile.measurement-report.v1",
  "profile": "order-events-to-order-item-facts",
  "inputs": {
    "expectedEventRatePerSec": 1000,
    "averageArrayLength": 5,
    "maxArrayLength": 200
  },
  "estimates": {
    "rowMultiplier": 5,
    "estimatedFactRowsPerSec": 5000
  },
  "warnings": []
}
```

## 5. DPM Readiness Output

DPM readiness is diagnostic, not execution.

```json
{
  "kind": "data-structure-profile.dpm-readiness.v1",
  "profile": "order-events-to-order-item-facts",
  "required": false,
  "policyRef": null,
  "diagnostics": [
    {
      "code": "dsp-privacy-dpm-ref-missing",
      "severity": "warning",
      "message": "Sensitive paths exist but no DPM policy reference is declared."
    }
  ]
}
```

## 6. UI Model

The visualization model should be a direct derivative of compile output and gate reports.

Minimum node fields:

- `id`
- `kind`
- `label`
- `taxonomyRef`
- `profileRef`
- `status`

Minimum edge fields:

- `from`
- `to`
- `kind`
- `transformRef`
- `diagnostics`

This keeps UI integration downstream from deterministic profile artifacts.

## 7. Initial Implementation

The first package spike lives in
[`../../../packages/data-structure-profile`](../../../packages/data-structure-profile).

Implemented source surfaces:

- `src/parse.ts` — profile YAML parsing.
- `src/taxonomy.ts` — taxonomy draft parsing and vocabulary lookup.
- `src/validate.ts` — profile validation report and `dsp-*` diagnostics.
- `src/lineage.ts` — deterministic lineage JSON.
- `src/measurement.ts` — row multiplier and dry-run estimates.
- `src/dpm.ts` — optional DPM readiness diagnostics.
- `src/adapters.ts` — quality-ledger run inputs and bench-compatible report input.
- `src/profile.test.ts` — fixture-backed contract tests.

Current limitation: the package does not write to SQLite, run `@qa-sdk/bench`, or render a
visualization. It emits plain JSON artifacts and adapter inputs for those later bridges.
