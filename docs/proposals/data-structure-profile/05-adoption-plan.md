---
def:
  id: data-structure-profile-05-adoption-plan
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
role: adoption-plan
supersedes: -
superseded_by: -
---

# Adoption Plan

## Purpose ^purpose

This plan turns the Data Structure Profile proposal into small, reviewable steps. It deliberately
starts with documents and fixtures before adding package code.

## Phase 0 - Proposal Set

Status: current.

Artifacts:

- `README.md`
- `00-design.md`
- `01-fit-audit.md`
- `02-taxonomy-layer.md`
- `03-profile-layer.md`
- `04-validation-and-diagnostics.md`
- `05-adoption-plan.md`
- `06-reference-map.md`
- `fixtures/README.md`

Exit criteria:

- Option B is documented as the working thesis.
- Repo and concept boundaries are explicit.
- Fit audit lists known qa-sdk mismatch points.
- Existing qa-sdk reuse depth is explicit enough to prevent accidental package coupling.

Verification:

- `git diff --check`

## Phase 1 - Taxonomy Draft

Status: drafted.

Artifacts:

- `docs/taxonomies/data-structure-profile.yaml`
- optional generated hash updates if taxonomy tooling requires them

Tasks:

1. Add initial axes from `02-taxonomy-layer.md`.
2. Add relation grammar for source/structure/transform/measurement/risk.
3. Validate lifecycle and address stability rules.

Exit criteria:

- taxonomy validates with existing taxonomy tooling.
- no profile instance contract is implemented yet.

## Phase 2 - Fixture Profile

Status: drafted.

Artifacts:

- `docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml`
- `docs/proposals/data-structure-profile/fixtures/order-event.schema.json`
- `docs/proposals/data-structure-profile/fixtures/order-event.sample.json`
- `docs/proposals/data-structure-profile/fixtures/expected-lineage.json`
- `docs/proposals/data-structure-profile/fixtures/expected-validation-report.json`
- `docs/proposals/data-structure-profile/fixtures/expected-measurement-report.json`
- `docs/proposals/data-structure-profile/fixtures/expected-dpm-readiness.json`

Tasks:

1. Define a Kafka-like order event fixture.
2. Define an item-array explode transform.
3. Define measurement assumptions.
4. Define quality gates for dedup, replay, schema drift, and array explosion.
5. Define optional DPM readiness reference behavior.

Exit criteria:

- the fixture is concrete enough to drive implementation tests later.
- no live Kafka or ClickHouse dependency exists.
- validation and measurement semantics are snapshot-friendly.

## Phase 3 - Profile Library Spike

Status: implemented as package spike.

Implemented package:

- `packages/data-structure-profile`

Tasks:

1. Parse profile YAML. Implemented in `packages/data-structure-profile/src/parse.ts`.
2. Resolve taxonomy kind refs. Implemented in `packages/data-structure-profile/src/taxonomy.ts`.
3. Validate structure and transform refs. Initial `dsp-*` diagnostics implemented in `packages/data-structure-profile/src/validate.ts`.
4. Emit validation report. Covered by `packages/data-structure-profile/src/profile.test.ts`.
5. Emit compiled lineage JSON. Implemented in `packages/data-structure-profile/src/lineage.ts`.
6. Emit measurement dry-run report. Implemented in `packages/data-structure-profile/src/measurement.ts`.

Exit criteria:

- fixture tests pass package-locally.
- package has no live connector I/O.
- DPM reference is a string only.

Verification:

- `pnpm --filter data-structure-profile test`
- `pnpm --filter data-structure-profile typecheck`
- `pnpm --filter data-structure-profile build`

## Phase 4 - Evidence Integration

Status: implemented as JSON adapter bridge.

Artifacts:

- `packages/data-structure-profile/src/adapters.ts`
- `toQualityLedgerRunInputs(validationReport)`
- `toBenchReportInput(measurementReport)`

Tasks:

1. Record gate outcomes from validation report. Implemented as quality-ledger `recordRun()` input objects.
2. Convert measurement dry-run output into bench-compatible report. Implemented as bench-compatible report input.
3. Keep validation semantics in profile layer, not ledger/bench. Preserved by avoiding runtime dependencies on `quality-ledger` and `@qa-sdk/bench`.

Exit criteria:

- one fixture run can be recorded as quality evidence by passing adapter output to `quality-ledger`.
- measurement report can be compared across two profile revisions by comparing bench-compatible summaries.

Verification:

- `pnpm --filter data-structure-profile test`
- `pnpm --filter data-structure-profile typecheck`
- `pnpm --filter data-structure-profile build`

## Phase 5 - Visualization Pilot

Status: implemented as read-only `viz-web` static preview.

Artifacts:

- `packages/viz-web/src/data-structure-profile/lineage-view.ts`
- `packages/viz-web/src/data-structure-profile/sample-lineage.ts`
- `packages/viz-web/src/data-structure-profile-preview.ts`
- `packages/viz-web/data-structure-profile.html`

Tasks:

1. Render source -> structure -> transform -> fact/metric graph. Implemented by SVG, Mermaid,
   and D3 projection helpers.
2. Overlay diagnostics by node/edge. Implemented by mapping validation diagnostics to lineage
   nodes through compiled diagnostic targets.
3. Keep editing out of scope. Preserved; the route uses static sample artifacts only.

Exit criteria:

- graph can be inspected without live backend.
- diagnostics map to graph elements.

Verification:

- `pnpm --filter @qa-sdk/viz-web test`
- `pnpm --filter @qa-sdk/viz-web build`

## Phase 6 - CLI / Fixture Runner

Status: implemented as package CLI.

Artifacts:

- `packages/data-structure-profile/src/cli-runner.ts`
- `packages/data-structure-profile/src/cli.ts`
- `packages/data-structure-profile/src/cli-runner.test.ts`
- `scripts/data-structure-profile-bridge-smoke.mjs`
- package `bin`: `data-structure-profile`

Tasks:

1. Expose package APIs through `data-structure-profile validate|compile|measure|dpm-readiness
   <profile>`.
2. Support taxonomy-backed validation via `--taxonomy`.
3. Support bridge smoke payloads via `validate --adapter quality-ledger` and
   `measure --adapter bench`.
4. Keep the CLI file-backed and deterministic; no live Kafka, DB, ledger, bench, or DPM execution.
5. Verify the adapter payloads against actual `quality-ledger` and `@qa-sdk/bench` public APIs from a
   repo-level smoke script.

Exit criteria:

- a checked-in profile can produce validation, lineage, measurement, and DPM readiness JSON through
  one command family.
- adapter payloads can be generated from the same entrypoint used by tests and docs.
- adapter payloads can be recorded by `QualityLedger.recordRun()` and rendered by
  `renderBenchmarkReport()` without adding runtime dependencies to `data-structure-profile`.

Verification:

- `pnpm --filter data-structure-profile test`
- `pnpm --filter data-structure-profile typecheck`
- `pnpm --filter data-structure-profile build`
- `pnpm --filter quality-ledger build`
- `pnpm --filter @qa-sdk/bench build`
- `node scripts/data-structure-profile-bridge-smoke.mjs`
- `node packages/data-structure-profile/dist/cli.js validate docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml --taxonomy docs/taxonomies/data-structure-profile.yaml`

## Phase 7 - Relational Fixture

Status: implemented as second deterministic fixture pack.

Artifacts:

- `docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml`
- `docs/proposals/data-structure-profile/fixtures/expected-customer-orders-*.json`

Tasks:

1. Add a PostgreSQL-style customer/orders relationship fixture.
2. Represent `table`, `relationship`, `join`, `pseudonymize`, and pseudonymized analytics fact
   lineage.
3. Exercise DPM-sensitive roles such as direct customer key, direct contact, and relationship key.
4. Reuse the checked-in expected artifacts in the `viz-web` preview to prevent sample drift.

Exit criteria:

- the fixture validates against the taxonomy draft.
- lineage includes table and relationship nodes.
- DPM readiness proves a required policy reference can satisfy sensitive-path checks.

Verification:

- `pnpm --filter data-structure-profile test`
- `pnpm --filter @qa-sdk/viz-web test`

## Acceptance Criteria For Proposal

Move from draft to under-review when:

1. Phase 1 taxonomy draft exists.
2. Phase 2 fixture profile exists.
3. Fit audit has been checked against actual taxonomy-engine/package surfaces.

Current status: satisfied. The proposal document set is now `under-review`.

Move from under-review to accepted when:

1. The fixture can be validated by a minimal implementation or scripted shadow validator.
2. The profile layer proves at least one concrete source-to-fact lineage.
3. The proposal does not require oa-sdk as a runtime dependency.
4. The next implementation package boundary is chosen.

## Explicit Non-goals

- Do not implement live Kafka ingestion in this proposal.
- Do not generate ClickHouse DDL in the MVP.
- Do not move DPM into qa-sdk.
- Do not make taxonomy-engine own profile-specific measurement math.
- Do not add web editing before deterministic lineage JSON is stable.
