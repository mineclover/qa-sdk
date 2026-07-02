# data-structure-profile

Fixture-first parser, validator, and compiler for the Data Structure Profile proposal.

## Scope

This package owns concrete profile artifacts:

- parse profile YAML,
- resolve profile vocabulary against the `data-structure-profile` taxonomy draft,
- emit validation reports with stable `dsp-*` diagnostics,
- emit deterministic lineage JSON,
- emit measurement dry-run reports,
- emit optional DPM readiness diagnostics,
- convert validation reports into quality-ledger `recordRun()` input objects,
- convert measurement reports into bench-compatible report input objects.

It does not connect to Kafka, ClickHouse, quality-ledger, bench, viz-web, registry-ui, or oa-sdk.
Those integrations should consume the plain JSON artifacts and adapter outputs later.

## Usage

```ts
import {
  assessDpmReadiness,
  compileLineage,
  measureProfile,
  parseProfile,
  parseProfileTaxonomy,
  toBenchReportInput,
  toQualityLedgerRunInputs,
  validateProfile,
} from "data-structure-profile";

const taxonomy = parseProfileTaxonomy(taxonomyYaml);
const profile = parseProfile(profileYaml);

const validation = validateProfile(profile, { taxonomy });
const lineage = compileLineage(profile);
const measurement = measureProfile(profile);
const dpm = assessDpmReadiness(profile);

const ledgerRuns = toQualityLedgerRunInputs(validation, {
  docVersion: profile.version,
});
const benchReportInput = toBenchReportInput(measurement);
```

## CLI

The package also exposes the same fixture runner as a CLI after build.

```bash
pnpm --filter data-structure-profile build

node packages/data-structure-profile/dist/cli.js validate \
  docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml \
  --taxonomy docs/taxonomies/data-structure-profile.yaml

node packages/data-structure-profile/dist/cli.js compile \
  docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml

node packages/data-structure-profile/dist/cli.js measure \
  docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml \
  --adapter bench

node packages/data-structure-profile/dist/cli.js dpm-readiness \
  docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml
```

Supported commands:

- `validate <profile.yaml> [--taxonomy <taxonomy.yaml>] [--adapter quality-ledger]`
- `compile <profile.yaml>`
- `measure <profile.yaml> [--adapter bench]`
- `dpm-readiness <profile.yaml>`

## Bridge Smoke

The package has no runtime dependency on `quality-ledger` or `@qa-sdk/bench`. The repository-level
smoke verifies the adapter outputs against those actual package surfaces after all three packages are
built.

```bash
pnpm --filter data-structure-profile build
pnpm --filter quality-ledger build
pnpm --filter @qa-sdk/bench build
node scripts/data-structure-profile-bridge-smoke.mjs
```

## Verification

```bash
pnpm --filter data-structure-profile test
pnpm --filter data-structure-profile typecheck
pnpm --filter data-structure-profile build
```
