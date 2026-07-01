# data-structure-profile

Fixture-first parser, validator, and compiler for the Data Structure Profile proposal.

## Scope

This package owns concrete profile artifacts:

- parse profile YAML,
- resolve profile vocabulary against the `data-structure-profile` taxonomy draft,
- emit validation reports with stable `dsp-*` diagnostics,
- emit deterministic lineage JSON,
- emit measurement dry-run reports,
- emit optional DPM readiness diagnostics.
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

## Verification

```bash
pnpm --filter data-structure-profile test
pnpm --filter data-structure-profile typecheck
pnpm --filter data-structure-profile build
```
