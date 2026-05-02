import { summarizeDistribution } from "./probe-transport.js";
import type {
  BenchmarkCounters,
  BenchmarkErrorSummary,
  BenchmarkHarness,
  BenchmarkRunConfig,
  BenchmarkRunSummary,
  BenchmarkWorkerSnapshot,
  TransportProbeSnapshot,
} from "./types.js";

export async function runBenchmark(
  config: BenchmarkRunConfig,
): Promise<BenchmarkRunSummary> {
  const concurrency = Math.max(1, config.concurrency ?? 1);
  const warmupIterations = Math.max(0, config.warmupIterations ?? 0);
  const measuredIterations = Math.max(1, config.measuredIterations);
  const measuredByWorker = splitIterations(measuredIterations, concurrency);
  const warmupByWorker = splitIterations(warmupIterations, concurrency);
  const startedAt = new Date();

  const workerResults = await Promise.all(
    Array.from({ length: concurrency }, async (_, workerId) => {
      const harness = await config.harnessFactory(workerId);
      return runWorker({
        harness,
        scenario: config.scenario,
        workerId,
        warmupIterations: warmupByWorker[workerId] ?? 0,
        measuredIterations: measuredByWorker[workerId] ?? 0,
      });
    }),
  );

  const completedAt = new Date();
  const latencies = workerResults.flatMap((result) => result.iterationLatencies);
  const counters = workerResults.reduce(
    (acc, result) => mergeCounters(acc, result.snapshot.counters),
    emptyCounters(),
  );
  const transport = aggregateTransportSnapshots(
    workerResults
      .map((result) => result.snapshot.transport)
      .filter((snapshot): snapshot is TransportProbeSnapshot => snapshot !== undefined),
  );
  const errors = aggregateErrorSummaries(
    workerResults
      .map((result) => result.snapshot.errors)
      .filter((summary): summary is BenchmarkErrorSummary => summary !== undefined),
  );
  const elapsedMs = Number((completedAt.getTime() - startedAt.getTime()).toFixed(3));

  return {
    scenarioId: config.scenario.id,
    scenarioName: config.scenario.name,
    concurrency,
    warmupIterations,
    measuredIterations,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    elapsedMs,
    scenarioLatencyMs: summarizeDistribution(latencies),
    scenarioRate: Number((measuredIterations / Math.max(elapsedMs / 1000, 0.001)).toFixed(3)),
    counters,
    ...(transport ? { transport } : {}),
    ...(errors ? { errors } : {}),
  };
}

async function runWorker(config: {
  harness: BenchmarkHarness;
  workerId: number;
  warmupIterations: number;
  measuredIterations: number;
  scenario: BenchmarkRunConfig["scenario"];
}): Promise<{ iterationLatencies: number[]; snapshot: BenchmarkWorkerSnapshot }> {
  const { harness } = config;

  try {
    for (let iteration = 0; iteration < config.warmupIterations; iteration += 1) {
      await config.scenario.run({
        client: harness.client,
        workerId: config.workerId,
        iteration,
        phase: "warmup",
      });
    }

    await harness.client.flush();
    harness.reset();

    const iterationLatencies: number[] = [];
    for (let iteration = 0; iteration < config.measuredIterations; iteration += 1) {
      const started = performance.now();
      await config.scenario.run({
        client: harness.client,
        workerId: config.workerId,
        iteration,
        phase: "measure",
      });
      iterationLatencies.push(performance.now() - started);
    }

    await harness.client.flush();
    const snapshot = harness.snapshot();
    return { iterationLatencies, snapshot };
  } finally {
    await harness.client.shutdown();
  }
}

function splitIterations(total: number, concurrency: number): number[] {
  return Array.from({ length: concurrency }, (_, index) =>
    Math.floor(total / concurrency) + (index < total % concurrency ? 1 : 0),
  );
}

function emptyCounters(): BenchmarkCounters {
  return {
    sessionsStarted: 0,
    eventsEmitted: 0,
    metricsEmitted: 0,
    flushCalls: 0,
  };
}

function mergeCounters(
  left: BenchmarkCounters,
  right: BenchmarkCounters,
): BenchmarkCounters {
  return {
    sessionsStarted: left.sessionsStarted + right.sessionsStarted,
    eventsEmitted: left.eventsEmitted + right.eventsEmitted,
    metricsEmitted: left.metricsEmitted + right.metricsEmitted,
    flushCalls: left.flushCalls + right.flushCalls,
  };
}

function aggregateTransportSnapshots(
  snapshots: TransportProbeSnapshot[],
): TransportProbeSnapshot | undefined {
  if (snapshots.length === 0) return undefined;

  const latencyValues = snapshots.flatMap((snapshot) => [
    snapshot.sendLatencyMs.min,
    snapshot.sendLatencyMs.p50,
    snapshot.sendLatencyMs.p95,
    snapshot.sendLatencyMs.p99,
    snapshot.sendLatencyMs.max,
  ]).filter((value) => value > 0);

  const hasBytes = snapshots.some((snapshot) => typeof snapshot.bytesSent === "number");
  const addressContext = aggregateAddressContextCoverage(
    snapshots.map((snapshot) => snapshot.addressContext).filter(
      (coverage): coverage is NonNullable<TransportProbeSnapshot["addressContext"]> =>
        coverage !== undefined,
    ),
  );

  return {
    envelopesSent: snapshots.reduce((acc, snapshot) => acc + snapshot.envelopesSent, 0),
    recordsSent: snapshots.reduce((acc, snapshot) => acc + snapshot.recordsSent, 0),
    failedSends: snapshots.reduce((acc, snapshot) => acc + snapshot.failedSends, 0),
    ...(hasBytes
      ? {
          bytesSent: snapshots.reduce(
            (acc, snapshot) => acc + (snapshot.bytesSent ?? 0),
            0,
          ),
        }
      : {}),
    sendLatencyMs: summarizeDistribution(latencyValues),
    ...(addressContext ? { addressContext } : {}),
  };
}

function aggregateErrorSummaries(
  summaries: BenchmarkErrorSummary[],
): BenchmarkErrorSummary | undefined {
  if (summaries.length === 0) return undefined;

  const byContext: Record<string, number> = {};
  let total = 0;

  for (const summary of summaries) {
    total += summary.total;
    for (const [context, count] of Object.entries(summary.byContext)) {
      byContext[context] = (byContext[context] ?? 0) + count;
    }
  }

  return { total, byContext };
}

function aggregateAddressContextCoverage(
  coverages: Array<NonNullable<TransportProbeSnapshot["addressContext"]>>,
) {
  if (coverages.length === 0) return undefined;

  const prefixes: Record<string, number> = {};
  let totalRecords = 0;
  let recordsWithAddressContext = 0;

  for (const coverage of coverages) {
    totalRecords += coverage.totalRecords;
    recordsWithAddressContext += coverage.recordsWithAddressContext;
    for (const [prefixId, count] of Object.entries(coverage.prefixes)) {
      prefixes[prefixId] = (prefixes[prefixId] ?? 0) + count;
    }
  }

  return {
    totalRecords,
    recordsWithAddressContext,
    prefixes,
    uniquePrefixes: Object.keys(prefixes).sort(),
  };
}
