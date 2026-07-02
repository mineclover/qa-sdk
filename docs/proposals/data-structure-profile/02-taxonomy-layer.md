---
def:
  id: data-structure-profile-02-taxonomy-layer
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
role: taxonomy-layer
supersedes: -
superseded_by: -
---

# Taxonomy Layer

## Purpose ^purpose

The taxonomy layer defines finite vocabularies and stable relation grammar for data-structure
judgment. It does not describe a concrete Kafka topic, JSON field, or fact table instance.

## 1. Ownership Rule ^decision-point

Make something taxonomy-level only when it is reusable across many profiles.

| Candidate | Taxonomy? | Reason |
|---|---:|---|
| `kafka`, `postgres`, `clickhouse` | yes | finite source/target kind vocabulary |
| `$.items[*]` | no | concrete profile path |
| `explode`, `aggregate`, `pseudonymize` | yes | reusable transform kind |
| `explode-items` | no | profile-local transform instance |
| `row-multiplier` | yes | reusable measurement kind |
| `estimated_rows_per_sec=5000` | no | report value |
| `dedup`, `schema-drift` | yes | reusable quality risk |
| `event-id-dedup-required` | no | profile-local gate |

## 2. Initial Axes

```yaml
taxonomy: data-structure-profile
version: 1
description: Data structure vocabulary for stream flattening, measurement, and DPM readiness.

axes:
  data-source-kind:
    entries:
      - { id: postgres, address: 0, lifecycle: approved }
      - { id: kafka, address: 1, lifecycle: approved }
      - { id: clickhouse, address: 2, lifecycle: approved }
      - { id: file, address: 3, lifecycle: approved }
      - { id: api, address: 4, lifecycle: review }
      - { id: cdc, address: 5, lifecycle: review }

  structure-kind:
    entries:
      - { id: table, address: 0, lifecycle: approved }
      - { id: topic, address: 1, lifecycle: approved }
      - { id: event, address: 2, lifecycle: approved }
      - { id: object, address: 3, lifecycle: approved }
      - { id: array, address: 4, lifecycle: approved }
      - { id: field, address: 5, lifecycle: approved }
      - { id: relationship, address: 6, lifecycle: approved }
      - { id: fact, address: 7, lifecycle: approved }
      - { id: metric, address: 8, lifecycle: approved }

  transform-kind:
    entries:
      - { id: project, address: 0, lifecycle: approved }
      - { id: cast, address: 1, lifecycle: approved }
      - { id: normalize, address: 2, lifecycle: approved }
      - { id: flatten, address: 3, lifecycle: approved }
      - { id: explode, address: 4, lifecycle: approved }
      - { id: join, address: 5, lifecycle: review }
      - { id: aggregate, address: 6, lifecycle: approved }
      - { id: pseudonymize, address: 7, lifecycle: review }

  measurement-kind:
    entries:
      - { id: event-rate, address: 0, lifecycle: approved }
      - { id: payload-size, address: 1, lifecycle: approved }
      - { id: array-length, address: 2, lifecycle: approved }
      - { id: row-multiplier, address: 3, lifecycle: approved }
      - { id: latency, address: 4, lifecycle: approved }
      - { id: storage, address: 5, lifecycle: approved }
      - { id: cost, address: 6, lifecycle: review }

  quality-risk:
    entries:
      - { id: dedup, address: 0, lifecycle: approved }
      - { id: replay, address: 1, lifecycle: approved }
      - { id: schema-drift, address: 2, lifecycle: approved }
      - { id: late-event, address: 3, lifecycle: approved }
      - { id: orphan, address: 4, lifecycle: approved }
      - { id: array-explosion, address: 5, lifecycle: approved }
      - { id: pii-leak, address: 6, lifecycle: approved }
      - { id: relationship-break, address: 7, lifecycle: approved }
```

## 3. Relation Grammar

Initial relations should stay semantic, not instance-specific.

```yaml
relations:
  source-can-emit:
    from: data-source-kind
    to: structure-kind
    kind: depends-on

  transform-applies-to:
    from: transform-kind
    to: structure-kind
    kind: depends-on

  transform-produces-measurement:
    from: transform-kind
    to: measurement-kind
    kind: projects-to

  risk-observed-by:
    from: quality-risk
    to: measurement-kind
    kind: depends-on
```

## 4. Constraints

Minimum taxonomy constraints:

- every axis entry must include lifecycle;
- address must be stable and unique within axis;
- `capacity >= entries.length * 2` where practical;
- transform relations must not imply runtime support;
- `pseudonymize` transform kind must not define DPM policy inline.

## 5. Output

The taxonomy layer should produce:

- stable vocabulary refs for profile YAML;
- relation graph for UI discovery;
- diff/migration evidence when vocabulary changes;
- lifecycle review points for uncertain adapter capabilities.

## 6. Current Draft Artifact

The first taxonomy draft has been checked in at
[`../../taxonomies/data-structure-profile.yaml`](../../taxonomies/data-structure-profile.yaml).

The draft intentionally uses only relation kinds currently accepted by taxonomy-engine:

- `contains`
- `depends-on`
- `binds`
- `projects-to`

Profile-specific lineage edges such as `emits`, `input`, `feeds`, and `produces` remain derived
artifact vocabulary in [fixtures/expected-lineage.json](./fixtures/expected-lineage.json), not
taxonomy relation kinds.
