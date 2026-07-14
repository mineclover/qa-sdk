/**
 * Stability PRD US-002 — real-repo inventory exploration.
 *
 * 실행: `pnpm --filter @qa-sdk/cli exec tsx scripts/stability-exploration.ts`
 * 출력: 분포 JSON → stdout (observation memo 작성용).
 */

import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { buildDeterministicLabelInventory } from 'deterministic-label-registry';

import { createDeterministicLabelInventoryAdapters } from '../src/lib/deterministic-label-inventory-adapters.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

const start = performance.now();
const inventory = await buildDeterministicLabelInventory({
  rootDir: repoRoot,
  adapters: createDeterministicLabelInventoryAdapters({ rootDir: repoRoot }),
  detectCompletedRecords: true,
  computeReadiness: true,
});
const elapsedMs = performance.now() - start;

const diagnosticsByCode: Record<string, number> = {};
for (const d of inventory.diagnostics) {
  diagnosticsByCode[d.code] = (diagnosticsByCode[d.code] ?? 0) + 1;
}

const skipReasons: Record<string, number> = {};
for (const s of inventory.skippedDocuments) {
  skipReasons[s.reason] = (skipReasons[s.reason] ?? 0) + 1;
}

const summary = {
  elapsedMs: Math.round(elapsedMs),
  documents: inventory.documents.length,
  records: inventory.records.length,
  candidates: inventory.candidates.length,
  diagnostics: inventory.diagnostics.length,
  skippedDocuments: inventory.skippedDocuments.length,
  completedRecords: inventory.completedRecords.length,
  byKind: inventory.summary.byKind,
  byState: inventory.summary.byState,
  byDiagnosticSeverity: inventory.summary.byDiagnosticSeverity,
  diagnosticsByCode,
  skipReasons,
};

console.log(JSON.stringify(summary, null, 2));
