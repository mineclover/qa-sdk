import { describe, expect, it } from "vitest";
import { renderBenchmarkReport } from "./report.js";
import type { BenchmarkRunSummary } from "./types.js";

describe("renderBenchmarkReport", () => {
  it("markdown report를 사람이 읽을 수 있는 형태로 렌더링한다", () => {
    const summary: BenchmarkRunSummary = {
      scenarioId: "checkout",
      scenarioName: "Checkout Journey",
      concurrency: 2,
      warmupIterations: 1,
      measuredIterations: 5,
      startedAt: "2026-03-29T00:00:00.000Z",
      completedAt: "2026-03-29T00:00:01.000Z",
      elapsedMs: 1000,
      scenarioRate: 5,
      scenarioLatencyMs: { min: 1, avg: 2, p50: 2, p95: 3, p99: 4, max: 5 },
      counters: {
        sessionsStarted: 5,
        eventsEmitted: 20,
        metricsEmitted: 5,
        flushCalls: 5,
      },
      transport: {
        envelopesSent: 5,
        recordsSent: 30,
        failedSends: 0,
        bytesSent: 2048,
        sendLatencyMs: { min: 0.1, avg: 0.2, p50: 0.2, p95: 0.3, p99: 0.4, max: 0.5 },
        addressContext: {
          totalRecords: 30,
          recordsWithAddressContext: 30,
          prefixes: { service: 30, flow_point: 10, tracking: 20 },
          uniquePrefixes: ["flow_point", "service", "tracking"],
        },
      },
    };

    const report = renderBenchmarkReport(summary, {
      format: "markdown",
      metadata: { transport: "noop", service: "shop/shopping-web" },
    });

    expect(report).toContain("# Benchmark Report");
    expect(report).toContain("## Throughput");
    expect(report).toContain("transport: `noop`");
    expect(report).toContain("| envelopes | 5 |");
    expect(report).toContain("## Address Context");
    expect(report).toContain("| flow_point | 10 |");
  });
});
