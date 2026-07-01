import type {
  BenchReportAdapterOptions,
  BenchReportInput,
  DistributionSummary,
  MeasurementReport,
  QualityLedgerAdapterOptions,
  QualityLedgerRunInput,
  ValidationReport,
} from "./types.js";

const DEFAULT_TIME = "1970-01-01T00:00:00.000Z";

export function toQualityLedgerRunInputs(
  report: ValidationReport,
  options: QualityLedgerAdapterOptions = {},
): QualityLedgerRunInput[] {
  const bundleId = options.bundleId ?? `data-structure-profile/${report.profile}`;
  const docVersion = options.docVersion ?? 1;
  const command = options.command ?? `data-structure-profile validate ${report.profile}`;
  const warnAsPass = options.warnAsPass ?? true;

  return report.checkedGates.map((gate) => {
    const blocking = gate.result === "fail" || (gate.result === "warn" && !warnAsPass);
    return {
      gateDocId: `${bundleId}/${gate.id}`,
      docVersion,
      bundleId,
      command,
      outcome: blocking ? "fail" : "pass",
      exitCode: blocking ? 1 : 0,
      notes: `risk=${gate.risk}; severity=${gate.severity}; result=${gate.result}; evidence=${gate.evidence}`,
      successPattern: gate.id,
      successPatternMatched: !blocking,
      ...(blocking ? { failureClass: "static-check-failure" as const } : {}),
    };
  });
}

export function toBenchReportInput(
  report: MeasurementReport,
  options: BenchReportAdapterOptions = {},
): BenchReportInput {
  const startedAt = options.startedAt ?? DEFAULT_TIME;
  const completedAt = options.completedAt ?? startedAt;

  return {
    title: "Data Structure Profile Measurement",
    metadata: {
      profile: report.profile,
      rowMultiplier: report.estimates.rowMultiplier,
      estimatedFactRowsPerSec: report.estimates.estimatedFactRowsPerSec,
      estimatedOutputBytesPerSec: report.estimates.estimatedOutputBytesPerSec,
    },
    summary: {
      scenarioId: `data-structure-profile:${report.profile}:measurement-dry-run`,
      scenarioName: `Data Structure Profile dry-run: ${report.profile}`,
      concurrency: 1,
      warmupIterations: 0,
      measuredIterations: 1,
      startedAt,
      completedAt,
      elapsedMs: elapsedMs(startedAt, completedAt),
      scenarioLatencyMs: zeroDistribution(),
      scenarioRate: report.estimates.estimatedFactRowsPerSec,
      counters: {
        sessionsStarted: 0,
        eventsEmitted: report.inputs.expectedEventRatePerSec,
        metricsEmitted: Object.keys(report.estimates).length,
        flushCalls: 0,
      },
      transport: {
        envelopesSent: report.inputs.expectedEventRatePerSec,
        recordsSent: report.estimates.estimatedFactRowsPerSec,
        failedSends: 0,
        bytesSent: report.estimates.estimatedOutputBytesPerSec,
        sendLatencyMs: zeroDistribution(),
      },
    },
  };
}

function zeroDistribution(): DistributionSummary {
  return { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
}

function elapsedMs(startedAt: string, completedAt: string): number {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (Number.isNaN(started) || Number.isNaN(completed)) return 0;
  return Math.max(0, completed - started);
}
