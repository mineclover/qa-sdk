import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryMetricsCollector } from "./metrics.js";
import { validateQueryEventKeys, validateQueryTransitions } from "./event-bridge.js";
import type { QueryMetricEvent } from "./types.js";

function makeEvent(overrides?: Partial<QueryMetricEvent>): QueryMetricEvent {
  return {
    timestamp: "2026-04-02T00:00:00Z",
    fingerprint: "select:orders",
    operation: "select",
    budgetId: null,
    verdict: "allow",
    durationMs: 10,
    waitedMs: 0,
    tags: {},
    ...overrides,
  };
}

// ── validateQueryEventKeys ────────────────────────────

describe("validateQueryEventKeys", () => {
  let collector: InMemoryMetricsCollector;

  beforeEach(() => {
    collector = new InMemoryMetricsCollector();
  });

  it("모두 매핑 존재 → 이슈 없음", () => {
    collector.record(makeEvent({ tags: { event_key: "order.create" } }));
    const issues = validateQueryEventKeys(collector, () => true);
    expect(issues).toEqual([]);
  });

  it("매핑 없는 event_key → warning", () => {
    collector.record(makeEvent({ tags: { event_key: "orphan.event" } }));
    const issues = validateQueryEventKeys(collector, () => false);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.eventKey).toBe("orphan.event");
    expect(issues[0]!.message).toContain("매핑 없음");
  });

  it("event_key 없는 쿼리는 무시", () => {
    collector.record(makeEvent({ tags: { budget_id: "b1" } }));
    const issues = validateQueryEventKeys(collector, () => false);
    expect(issues).toEqual([]);
  });
});

// ── validateQueryTransitions ──────────────────────────

describe("validateQueryTransitions", () => {
  let collector: InMemoryMetricsCollector;

  beforeEach(() => {
    collector = new InMemoryMetricsCollector();
  });

  it("정합 → 이슈 없음", () => {
    collector.record(makeEvent({ tags: { event_key: "e1", transition: "t1" } }));
    const issues = validateQueryTransitions(collector, (tid) =>
      tid === "t1" ? ["e1"] : undefined,
    );
    expect(issues).toEqual([]);
  });

  it("미등록 transition → warning", () => {
    collector.record(makeEvent({ tags: { event_key: "e1", transition: "ghost" } }));
    const issues = validateQueryTransitions(collector, () => undefined);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("미등록");
  });

  it("TransitionDef에 없는 event_key → warning", () => {
    collector.record(makeEvent({ tags: { event_key: "e1", transition: "t1" } }));
    collector.record(makeEvent({ tags: { event_key: "extra", transition: "t1" } }));
    const issues = validateQueryTransitions(collector, (tid) =>
      tid === "t1" ? ["e1"] : undefined,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.eventKey).toBe("extra");
  });
});
