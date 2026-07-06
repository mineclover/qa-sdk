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
sources:
  - packages/data-structure-profile/src/profile.test.ts
  - packages/data-structure-profile/src/cli-runner.test.ts
  - packages/data-structure-profile/src/parse.ts
  - packages/data-structure-profile/src/validate.ts
  - packages/data-structure-profile/src/lineage.ts
  - packages/data-structure-profile/src/measurement.ts
  - packages/data-structure-profile/src/dpm.ts
  - docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml
  - docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml
  - docs/proposals/data-structure-profile/fixtures/order-event.schema.json
  - docs/proposals/data-structure-profile/fixtures/order-event.sample.json
  - docs/proposals/data-structure-profile/fixtures/customer-orders.schema.sql
  - docs/proposals/data-structure-profile/fixtures/expected-validation-report.json
  - docs/proposals/data-structure-profile/fixtures/expected-lineage.json
  - docs/proposals/data-structure-profile/fixtures/expected-measurement-report.json
  - docs/proposals/data-structure-profile/fixtures/expected-dpm-readiness.json
  - docs/proposals/data-structure-profile/fixtures/expected-customer-orders-validation-report.json
  - docs/proposals/data-structure-profile/fixtures/expected-customer-orders-lineage.json
  - docs/proposals/data-structure-profile/fixtures/expected-customer-orders-measurement-report.json
  - docs/proposals/data-structure-profile/fixtures/expected-customer-orders-dpm-readiness.json
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

The fixtures intentionally have no live Kafka, PostgreSQL, ClickHouse, or DPM runtime dependency.
They are package-local unit test inputs for parser, validator, lineage, measurement, DPM readiness,
CLI output, and profile isolation checks.

## Current Verification ^evidence

- `profile.test.ts` compares both profiles against deterministic validation, lineage, measurement, and DPM readiness snapshots.
- `profile.test.ts` runs the order-event and customer-orders profiles in the same test process and verifies artifact ids, lineage nodes, quality-ledger bundle ids, bench scenario ids, and DPM policy refs remain profile-local.
- `cli-runner.test.ts` uses these fixtures to verify `validate`, `compile`, `measure`, `dpm-readiness`, `quality-ledger` adapter output, and `bench` adapter output.
