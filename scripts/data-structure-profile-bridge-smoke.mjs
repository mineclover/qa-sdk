#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  measureProfile,
  parseProfile,
  toBenchReportInput,
  toQualityLedgerRunInputs,
  validateProfile,
} from '../packages/data-structure-profile/dist/index.js';
import { renderBenchmarkReport } from '../packages/bench/dist/index.js';
import { QualityLedger, SqliteQualityStore } from '../packages/quality-ledger/dist/index.js';

const repoRoot = resolve(import.meta.dirname, '..');
const profilePath = resolve(
  repoRoot,
  process.argv[2] ?? 'docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml',
);

const profile = parseProfile(readFileSync(profilePath, 'utf8'));
const validation = validateProfile(profile);
const measurement = measureProfile(profile);

const ledgerRuns = toQualityLedgerRunInputs(validation, {
  command: `data-structure-profile validate ${profile.profile}`,
});

const store = new SqliteQualityStore(':memory:');
try {
  const ledger = new QualityLedger(store);
  for (const run of ledgerRuns) {
    ledger.recordRun(run);
  }

  const verification = ledger.resolveBundleVerification(
    ledgerRuns.map((run) => ({
      gateDocId: run.gateDocId,
      docVersion: run.docVersion,
      bundleId: run.bundleId,
    })),
  );

  if (!verification.verified) {
    throw new Error(`quality-ledger bridge smoke failed for ${profile.profile}`);
  }
} finally {
  store.close();
}

const benchInput = toBenchReportInput(measurement);
const renderedReport = renderBenchmarkReport(benchInput.summary, {
  title: benchInput.title,
  metadata: benchInput.metadata,
  format: 'markdown',
});

if (
  !renderedReport.includes('Data Structure Profile Measurement') ||
  !renderedReport.includes(profile.profile)
) {
  throw new Error(`bench bridge smoke failed for ${profile.profile}`);
}

console.log(
  JSON.stringify(
    {
      profile: profile.profile,
      qualityLedgerRuns: ledgerRuns.length,
      benchReportBytes: Buffer.byteLength(renderedReport, 'utf8'),
    },
    null,
    2,
  ),
);
