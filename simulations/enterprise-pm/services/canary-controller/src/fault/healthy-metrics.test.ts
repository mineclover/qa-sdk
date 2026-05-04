// @def.boundary sim-canary-controller
// healthy-metrics fault — applyTo wrapper 단위 테스트.
//
// 검증:
//   (a) disabled (기본) → passthrough.
//   (b) enabled → sources 모두 ok=true/weight=1.0.
//   (c) enabled → 모든 신호가 PASS 임계 안 합성 값.
//   (d) reset() → disabled 상태 복귀.

import { describe, expect, it } from "vitest";
import { HealthyMetricsFault } from "./healthy-metrics.js";
import type { ScrapeResult } from "../metrics/metrics-scrape.service.js";

const emptyScrape: ScrapeResult = {
  scrapedAt: "2026-05-04T13:00:00.000Z",
  signals: {},
  sources: [
    { name: "metrics", ok: false, weight: 0.3 },
    { name: "ingest", ok: false, weight: 0.3 },
    { name: "audit", ok: false, weight: 0.3 },
  ],
};

describe("HealthyMetricsFault", () => {
  it("(a) disabled → applyTo passthrough", () => {
    const f = new HealthyMetricsFault();
    const out = f.applyTo(emptyScrape);
    expect(out).toBe(emptyScrape);
  });

  it("(b) enabled → sources 모두 ok=true/weight=1.0", async () => {
    const f = new HealthyMetricsFault();
    await f.enable({});
    const out = f.applyTo(emptyScrape);
    expect(out.sources.every((s) => s.ok && s.weight === 1.0)).toBe(true);
    expect(out.sources.length).toBe(3);
  });

  it("(c) enabled → 신호가 PASS 합성 값으로 채워짐", async () => {
    const f = new HealthyMetricsFault();
    await f.enable({});
    const out = f.applyTo(emptyScrape);
    expect(out.signals["compatibility.schemaCompatRate"]?.value).toBe(1.0);
    expect(out.signals["auditSafety.criticalAnomalyRate"]?.value).toBe(0);
    expect(out.signals["perf.errorRate"]?.value).toBe(0.005);
    expect(out.signals["loadPressure.RPS"]?.value).toBe(10);
    // 12개 신호 모두 — spec 01 §2 매트릭스.
    expect(Object.keys(out.signals).length).toBeGreaterThanOrEqual(12);
  });

  it("(d) reset → disabled 상태로 복귀, 이후 applyTo passthrough", async () => {
    const f = new HealthyMetricsFault();
    await f.enable({});
    expect(f.isEnabled()).toBe(true);
    await f.reset();
    expect(f.isEnabled()).toBe(false);
    expect(f.applyTo(emptyScrape)).toBe(emptyScrape);
  });
});
