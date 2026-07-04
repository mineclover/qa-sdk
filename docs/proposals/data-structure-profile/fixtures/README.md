---
def:
  id: data-structure-profile-fixtures-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_fixture
  tier: component
  depth: specification
status: implemented
date: 2026-07-01
part_of: data-structure-profile
role: fixture-index
supersedes: -
superseded_by: -
---

# Data Structure Profile Fixtures

This directory contains the first deterministic fixture pack for Data Structure Profile.

| File | Role |
|---|---|
| [order-events.profile.yaml](./order-events.profile.yaml) | Kafka-like source-to-fact profile |
| [customer-orders.profile.yaml](./customer-orders.profile.yaml) | PostgreSQL table relationship to pseudonymized analytics profile |
| [customer-orders.schema.sql](./customer-orders.schema.sql) | relational source and target table sketch |
| [order-event.schema.json](./order-event.schema.json) | JSON Schema for the source event |
| [order-event.sample.json](./order-event.sample.json) | representative source payload |
| [expected-lineage.json](./expected-lineage.json) | compiler lineage snapshot |
| [expected-validation-report.json](./expected-validation-report.json) | validator output snapshot |
| [expected-measurement-report.json](./expected-measurement-report.json) | dry-run measurement snapshot |
| [expected-dpm-readiness.json](./expected-dpm-readiness.json) | privacy readiness snapshot |
| `expected-customer-orders-*.json` | deterministic snapshots for the relational profile |

The fixture intentionally has no live Kafka or ClickHouse dependency. It should be usable as a
package-local unit test input once a Data Structure Profile implementation exists.
