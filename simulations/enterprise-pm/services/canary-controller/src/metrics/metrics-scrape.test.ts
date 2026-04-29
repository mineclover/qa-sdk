// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §5 t=0s — 3 source 병렬 fetch + fail-open + 매트릭스 전수 수집.

import { describe, it, expect, vi, afterEach } from "vitest";
import { MetricsScrapeService } from "./metrics-scrape.service.js";

const cfg = {
  metricsUrl: "http://m",
  ingestUrl: "http://i",
  auditUrl: "http://a",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MetricsScrapeService (spec 01 §5)", () => {
  it("aggregates 3 sources; collects 12 signals when all source healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/metrics")) {
          return new Response(
            JSON.stringify({
              errorRate: 0.01,
              p95LatencyDelta: 0.1,
              RPS: 50,
              CPU: 30,
              dbPoolUtilization: 0.4,
            }),
          );
        }
        if (url.includes("schema-compat")) {
          return new Response(JSON.stringify({ schemaCompatRate: 1.0 }));
        }
        return new Response(
          JSON.stringify({
            criticalAnomalyRate: 0,
            denyRateDelta: 0,
            avgConfidenceDelta: 0,
            replicationLagMs: 100,
            timeSinceLastReplicaChange: 999_999,
          }),
        );
      }),
    );
    const out = await new MetricsScrapeService(cfg).scrape();
    // 12개 signal — perf.errorRate / perf.p95LatencyDelta / compatibility.schemaCompatRate
    // / decisionQuality.denyRateDelta / decisionQuality.avgConfidenceDelta
    // / auditSafety.criticalAnomalyRate / replicationHealth.replicationLagMs
    // / loadPressure.RPS / loadPressure.p95LatencyDelta
    // / resourceHeadroom.CPU / resourceHeadroom.dbPoolUtilization
    // / stability.timeSinceLastReplicaChange
    expect(Object.keys(out.signals)).toHaveLength(12);
    expect(out.sources.every((s) => s.ok)).toBe(true);
    expect(out.sources.every((s) => s.weight === 1)).toBe(true);
  });

  it("fails open when ingest down — weight=0.3 + schema-compat signal 누락", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/metrics")) {
          return new Response(
            JSON.stringify({
              errorRate: 0.01,
              p95LatencyDelta: 0.1,
              RPS: 50,
              CPU: 30,
              dbPoolUtilization: 0.4,
            }),
          );
        }
        if (url.includes("schema-compat")) {
          throw new Error("ECONNREFUSED");
        }
        return new Response(
          JSON.stringify({
            criticalAnomalyRate: 0,
            denyRateDelta: 0,
            avgConfidenceDelta: 0,
            replicationLagMs: 100,
            timeSinceLastReplicaChange: 999_999,
          }),
        );
      }),
    );
    const out = await new MetricsScrapeService(cfg).scrape();
    const ingest = out.sources.find((s) => s.name === "ingest")!;
    expect(ingest.ok).toBe(false);
    expect(ingest.weight).toBe(0.3);
    // schema-compat은 ingest source — 누락
    expect(out.signals["compatibility.schemaCompatRate"]).toBeUndefined();
    // metrics / audit signal은 정상 수집
    expect(out.signals["perf.errorRate"]?.value).toBe(0.01);
    expect(out.signals["auditSafety.criticalAnomalyRate"]?.value).toBe(0);
  });

  it("fetch는 모두 AbortSignal을 가진다 (5s timeout)", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({})),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await new MetricsScrapeService(cfg).scrape();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    for (const call of fetchSpy.mock.calls) {
      const opts = call[1] as { signal?: AbortSignal } | undefined;
      expect(opts?.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
