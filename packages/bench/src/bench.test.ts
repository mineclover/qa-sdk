import { describe, expect, it } from "vitest";
import { NoopTransport, type TransmissionEnvelope } from "@qa-sdk/sdk";
import { DEMO_CATALOG } from "demo-snapshot";
import { createBridgeBenchmarkHarness } from "./bridge-harness.js";
import { createBenchmarkQaContext } from "./context.js";
import { createQaLoggerBenchmarkHarness } from "./logger-harness.js";
import { runBenchmark } from "./runner.js";
import { createCheckoutScenario, createSequenceScenario } from "./scenario.js";
import type { BenchmarkBridge } from "./types.js";

describe("@qa-sdk/bench", () => {
  it("QaLogger 하네스로 warmup을 제외한 측정 요약을 만든다", async () => {
    const scenario = createSequenceScenario({
      id: "simple",
      name: "Simple Scenario",
      steps: [
        { kind: "session", scenarioId: "simple" },
        { kind: "event", eventKey: "page_view", payload: { page: "/bench" } },
        { kind: "metric", name: "benchmark.simple", value: 1, type: "counter" },
        { kind: "flush" },
      ],
    });

    const summary = await runBenchmark({
      scenario,
      concurrency: 2,
      warmupIterations: 2,
      measuredIterations: 6,
      harnessFactory: () =>
        createQaLoggerBenchmarkHarness({
          transport: new NoopTransport(),
          owner: { owner_type: "workspace", owner_id: "qa-sdk" },
          source: {
            service_name: "bench-test",
            sdk_name: "@qa-sdk/bench",
            sdk_version: "0.1.0",
          },
          runtime: { platform: "node", os_version: process.version },
          build: { env: "dev" },
          batchSize: 8,
          flushIntervalMs: 0,
          measureEnvelopeBytes: true,
          infraContext: { service: "service:v1:0" },
        }),
    });

    expect(summary.measuredIterations).toBe(6);
    expect(summary.warmupIterations).toBe(2);
    expect(summary.counters.sessionsStarted).toBe(6);
    expect(summary.counters.eventsEmitted).toBe(6);
    expect(summary.counters.metricsEmitted).toBe(6);
    expect(summary.transport?.recordsSent).toBe(18);
    expect(summary.transport?.envelopesSent).toBe(6);
    expect(summary.transport?.bytesSent).toBeGreaterThan(0);
    expect(summary.transport?.addressContext?.prefixes.service).toBe(18);
  });

  it("qa-context 기반 preset scenario는 prefix coverage를 남긴다", async () => {
    const qaContext = createBenchmarkQaContext({
      catalog: DEMO_CATALOG,
      serviceConfig: {
        namespace: "shop",
        name: "shopping-web",
        env: "prod",
        region: "asia",
      },
    });

    const summary = await runBenchmark({
      scenario: createCheckoutScenario({ qaContext }),
      measuredIterations: 2,
      warmupIterations: 0,
      harnessFactory: () =>
        createQaLoggerBenchmarkHarness({
          transport: new NoopTransport(),
          owner: { owner_type: "workspace", owner_id: "qa-sdk" },
          source: {
            service_name: "bench-test",
            sdk_name: "@qa-sdk/bench",
            sdk_version: "0.1.0",
          },
          runtime: { platform: "node", os_version: process.version },
          build: { env: "dev" },
          batchSize: 8,
          flushIntervalMs: 0,
          measureEnvelopeBytes: true,
          infraContext: qaContext.infraContext(),
        }),
    });

    expect(summary.transport?.addressContext?.uniquePrefixes).toEqual(
      expect.arrayContaining(["service", "page_view", "tracking", "flow_point"]),
    );
  });

  it("bridge 하네스는 debug envelope delta를 측정한다", async () => {
    const bridge = createMemoryBridge();
    const harness = createBridgeBenchmarkHarness(bridge);

    bridge.startSession("warmup");
    bridge.emitEvent("page_view");
    await bridge.flush();

    harness.reset();

    harness.client.startSession("measure");
    harness.client.emitEvent("click");
    harness.client.emitMetric("benchmark.click", 1, { type: "counter" });
    await harness.client.flush();

    const snapshot = harness.snapshot();
    expect(snapshot.counters.sessionsStarted).toBe(1);
    expect(snapshot.counters.eventsEmitted).toBe(1);
    expect(snapshot.counters.metricsEmitted).toBe(1);
    expect(snapshot.transport?.envelopesSent).toBe(1);
    expect(snapshot.transport?.recordsSent).toBe(3);
  });
});

function createMemoryBridge(): BenchmarkBridge {
  const sent: TransmissionEnvelope[] = [];
  let buffered: Array<Record<string, unknown>> = [];

  return {
    startSession(): { traceId: string; sessionId: string } {
      buffered.push({ event_key: "session_start" });
      return { traceId: "trc_test", sessionId: "qas_test" };
    },

    emitEvent(eventKey: string): void {
      buffered.push({ event_key: eventKey });
    },

    emitMetric(name: string, value: number): void {
      buffered.push({ metric_name: name, metric_value: value });
    },

    async flush(): Promise<void> {
      if (buffered.length === 0) return;
      sent.push({
        transmission_id: `txm_${sent.length + 1}`,
        sent_at: new Date("2026-03-29T00:00:00.000Z").toISOString(),
        owner: { owner_type: "workspace", owner_id: "qa-sdk" },
        source: { service_name: "bridge-test", sdk_name: "@qa-sdk/bench", sdk_version: "0.1.0" },
        runtime: { platform: "node" },
        build: { env: "dev" },
        records: buffered as never[],
      });
      buffered = [];
    },

    async shutdown(): Promise<void> {
      await this.flush();
    },

    getDebugEnvelopes(): readonly TransmissionEnvelope[] {
      return sent;
    },
  };
}
