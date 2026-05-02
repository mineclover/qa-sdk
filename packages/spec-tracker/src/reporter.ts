// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * 리포터 — 수집된 증거를 specId별로 집계.
 */
import type { SpecCollector } from "./collector.js";
import type {
  ContractEvidence,
  ContractReport,
  MarkerSummary,
  VerificationSummary,
} from "./types.js";

function aggregateMarkers(evidences: readonly ContractEvidence[]): Record<string, MarkerSummary> {
  const result: Record<string, MarkerSummary> = {};
  for (const e of evidences) {
    const key = e.marker ?? "_unmarked";
    const prev = result[key] ?? { total: 0, passed: 0, failed: 0, skipped: 0 };
    result[key] = {
      total: prev.total + 1,
      passed: prev.passed + (e.status === "pass" ? 1 : 0),
      failed: prev.failed + (e.status === "fail" ? 1 : 0),
      skipped: prev.skipped + (e.status === "skip" ? 1 : 0),
    };
  }
  return result;
}

function buildReport(specId: string, evidences: readonly ContractEvidence[]): ContractReport {
  const passed = evidences.filter((e) => e.status === "pass").length;
  const failed = evidences.filter((e) => e.status === "fail").length;
  const skipped = evidences.filter((e) => e.status === "skip").length;
  const testable = passed + failed;

  let lastVerified = "";
  for (const e of evidences) {
    if (e.timestamp > lastVerified) lastVerified = e.timestamp;
  }

  return {
    specId,
    evidences: evidences.length,
    passed,
    failed,
    skipped,
    markers: aggregateMarkers(evidences),
    coverage: testable > 0 ? passed / testable : 0,
    lastVerified,
  };
}

export function generateReport(collector: SpecCollector, specIds?: readonly string[]): VerificationSummary {
  const targetIds = specIds ?? collector.specIds();
  const reports: ContractReport[] = [];

  for (const specId of targetIds) {
    const evidences = collector.bySpec(specId);
    if (evidences.length > 0) {
      reports.push(buildReport(specId, evidences));
    }
  }

  return {
    reports,
    totalSpecs: targetIds.length,
    verifiedSpecs: reports.length,
    fullyPassed: reports.filter((r) => r.failed === 0 && r.passed > 0).length,
    generatedAt: new Date().toISOString(),
  };
}
