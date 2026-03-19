import { describe, it, expect, vi } from "vitest";
import { aggregateMetrics } from "./metric-aggregator.js";
import type { StoredRecord, MetricRollupStore, MetricRollupInsert } from "@qa-sdk/core";

function makeMetricRecord(overrides: Partial<StoredRecord> = {}): StoredRecord {
  return {
    logId: "l1",
    traceId: "tr1",
    spanId: "sp1",
    timestamp: new Date("2026-01-01T12:00:30Z"),
    recordKind: "metric",
    eventKey: "metric.event",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: {},
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockRollupStore(): MetricRollupStore & { calls: MetricRollupInsert[] } {
  const calls: MetricRollupInsert[] = [];
  return {
    calls,
    upsert: vi.fn(async (r: MetricRollupInsert) => { calls.push(r); }),
    query: vi.fn(async () => []),
  };
}

describe("aggregateMetrics", () => {
  it("빈 배열이면 0 반환", async () => {
    const store = createMockRollupStore();
    const count = await aggregateMetrics([], store);
    expect(count).toBe(0);
    expect(store.calls).toHaveLength(0);
  });

  it("counter: 값을 합산한다", async () => {
    const store = createMockRollupStore();
    const records = [
      makeMetricRecord({ logId: "l1", metricType: "counter", metricName: "http.request.count", metricValue: 5 }),
      makeMetricRecord({ logId: "l2", metricType: "counter", metricName: "http.request.count", metricValue: 3 }),
    ];

    const count = await aggregateMetrics(records, store);
    expect(count).toBe(1);
    expect(store.calls[0].aggSum).toBe(8);
    expect(store.calls[0].aggCount).toBe(2);
  });

  it("gauge: last/min/max/avg를 계산한다", async () => {
    const store = createMockRollupStore();
    const records = [
      makeMetricRecord({ logId: "l1", metricType: "gauge", metricName: "cpu.usage", metricValue: 0.5 }),
      makeMetricRecord({ logId: "l2", metricType: "gauge", metricName: "cpu.usage", metricValue: 0.9 }),
      makeMetricRecord({ logId: "l3", metricType: "gauge", metricName: "cpu.usage", metricValue: 0.7 }),
    ];

    await aggregateMetrics(records, store);

    const r = store.calls[0];
    expect(r.aggLast).toBe(0.7);
    expect(r.aggMin).toBe(0.5);
    expect(r.aggMax).toBe(0.9);
    expect(r.aggAvg).toBeCloseTo(0.7);
    expect(r.aggCount).toBe(3);
  });

  it("metric_name별로 그룹핑한다", async () => {
    const store = createMockRollupStore();
    const records = [
      makeMetricRecord({ logId: "l1", metricType: "counter", metricName: "a", metricValue: 1 }),
      makeMetricRecord({ logId: "l2", metricType: "counter", metricName: "b", metricValue: 2 }),
      makeMetricRecord({ logId: "l3", metricType: "counter", metricName: "a", metricValue: 3 }),
    ];

    const count = await aggregateMetrics(records, store);
    expect(count).toBe(2); // "a"와 "b" 두 그룹

    const aRollup = store.calls.find((c) => c.metricName === "a");
    const bRollup = store.calls.find((c) => c.metricName === "b");
    expect(aRollup?.aggSum).toBe(4);
    expect(bRollup?.aggSum).toBe(2);
  });

  it("address_context가 다르면 별도 그룹", async () => {
    const store = createMockRollupStore();
    const records = [
      makeMetricRecord({
        logId: "l1", metricType: "counter", metricName: "req", metricValue: 1,
        addressContext: { "k8s": "k8s:v1:1" },
      }),
      makeMetricRecord({
        logId: "l2", metricType: "counter", metricName: "req", metricValue: 2,
        addressContext: { "k8s": "k8s:v1:2" },
      }),
    ];

    const count = await aggregateMetrics(records, store);
    expect(count).toBe(2);
  });

  it("windowType=1m, windowStart가 분 단위로 truncate된다", async () => {
    const store = createMockRollupStore();
    const records = [
      makeMetricRecord({
        logId: "l1", metricType: "counter", metricName: "x", metricValue: 1,
        timestamp: new Date("2026-01-01T12:05:47Z"),
      }),
    ];

    await aggregateMetrics(records, store);

    expect(store.calls[0].windowType).toBe("1m");
    expect(store.calls[0].windowStart).toEqual(new Date("2026-01-01T12:05:00Z"));
    expect(store.calls[0].windowEnd).toEqual(new Date("2026-01-01T12:06:00Z"));
  });
});
