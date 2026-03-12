import { describe, expect, it } from "vitest";
import { reconstruct } from "./reconstruct.js";
import type { EventRecord } from "@qa-sdk/core";

function buildRecord(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    log_id: "log_1",
    timestamp: "2026-03-12T10:00:00.000Z",
    record_kind: "log",
    trace_id: "trace_1",
    span_id: "span_1",
    event_key: "event.one",
    event_version: "001",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: {},
    ...overrides,
  };
}

describe("reconstruct", () => {
  it("creates nodes from records", () => {
    const records = [
      buildRecord({ log_id: "log_a", span_id: "span_a", event_key: "checkout.start" }),
      buildRecord({ log_id: "log_b", span_id: "span_b", event_key: "checkout.end", timestamp: "2026-03-12T10:00:01.000Z" }),
    ];

    const graph = reconstruct("trace_1", records);

    expect(graph.trace_id).toBe("trace_1");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].id).toBe("log_a");
    expect(graph.nodes[0].event_key).toBe("checkout.start");
    expect(graph.nodes[1].id).toBe("log_b");
  });

  it("sorts records by timestamp ascending", () => {
    const records = [
      buildRecord({ log_id: "log_late", span_id: "span_1", timestamp: "2026-03-12T10:00:02.000Z" }),
      buildRecord({ log_id: "log_early", span_id: "span_1", timestamp: "2026-03-12T10:00:00.000Z" }),
    ];

    const graph = reconstruct("trace_1", records);

    expect(graph.nodes[0].id).toBe("log_early");
    expect(graph.nodes[1].id).toBe("log_late");
  });

  it("sorts spans before logs at same timestamp", () => {
    const records = [
      buildRecord({ log_id: "log_1", span_id: "span_1", record_kind: "log", timestamp: "2026-03-12T10:00:00.000Z" }),
      buildRecord({ log_id: "span_1", span_id: "span_1", record_kind: "span", timestamp: "2026-03-12T10:00:00.000Z" }),
    ];

    const graph = reconstruct("trace_1", records);

    expect(graph.nodes[0].record_kind).toBe("span");
    expect(graph.nodes[1].record_kind).toBe("log");
  });

  it("creates parent_child edges from span hierarchy", () => {
    const records = [
      buildRecord({ log_id: "parent", span_id: "span_parent" }),
      buildRecord({
        log_id: "child",
        span_id: "span_child",
        parent_span_id: "span_parent",
        timestamp: "2026-03-12T10:00:01.000Z",
      }),
    ];

    const graph = reconstruct("trace_1", records);

    const parentChildEdges = graph.edges.filter((e) => e.type === "parent_child");
    expect(parentChildEdges).toEqual([
      { from: "parent", to: "child", type: "parent_child" },
    ]);
  });

  it("creates temporal edges within same span (span-local strategy)", () => {
    const records = [
      buildRecord({ log_id: "log_a", span_id: "span_1", timestamp: "2026-03-12T10:00:00.000Z" }),
      buildRecord({ log_id: "log_b", span_id: "span_1", timestamp: "2026-03-12T10:00:01.000Z" }),
      buildRecord({ log_id: "log_c", span_id: "span_2", timestamp: "2026-03-12T10:00:02.000Z" }),
    ];

    const graph = reconstruct("trace_1", records);

    const temporalEdges = graph.edges.filter((e) => e.type === "temporal");
    // Only log_a → log_b (same span), NOT log_b → log_c (different spans)
    expect(temporalEdges).toEqual([
      { from: "log_a", to: "log_b", type: "temporal" },
    ]);
  });

  it("creates global temporal edges when strategy is global", () => {
    const records = [
      buildRecord({ log_id: "log_a", span_id: "span_1", timestamp: "2026-03-12T10:00:00.000Z" }),
      buildRecord({ log_id: "log_b", span_id: "span_2", timestamp: "2026-03-12T10:00:01.000Z" }),
      buildRecord({ log_id: "log_c", span_id: "span_3", timestamp: "2026-03-12T10:00:02.000Z" }),
    ];

    const graph = reconstruct("trace_1", records, { temporalStrategy: "global" });

    const temporalEdges = graph.edges.filter((e) => e.type === "temporal");
    expect(temporalEdges).toEqual([
      { from: "log_a", to: "log_b", type: "temporal" },
      { from: "log_b", to: "log_c", type: "temporal" },
    ]);
  });

  it("deduplicates edges", () => {
    // Two records in same span with parent — produces both parent_child and temporal
    // No duplicates expected since they have different types
    const records = [
      buildRecord({ log_id: "parent", span_id: "span_root", timestamp: "2026-03-12T10:00:00.000Z" }),
      buildRecord({ log_id: "child_a", span_id: "span_child", parent_span_id: "span_root", timestamp: "2026-03-12T10:00:01.000Z" }),
      buildRecord({ log_id: "child_b", span_id: "span_child", parent_span_id: "span_root", timestamp: "2026-03-12T10:00:02.000Z" }),
    ];

    const graph = reconstruct("trace_1", records);

    // Check no duplicate edge keys
    const edgeKeys = graph.edges.map((e) => `${e.from}:${e.to}:${e.type}`);
    expect(edgeKeys.length).toBe(new Set(edgeKeys).size);
  });

  it("handles single record without edges", () => {
    const records = [buildRecord({ log_id: "solo", span_id: "span_solo" })];

    const graph = reconstruct("trace_1", records);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toEqual([]);
  });

  it("handles empty records", () => {
    const graph = reconstruct("trace_1", []);

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it("maps EventRecord fields to RuntimeNode correctly", () => {
    const record = buildRecord({
      log_id: "log_x",
      span_id: "span_x",
      event_key: "order.placed",
      event_version: "002",
      record_kind: "span",
      span_name: "place_order",
      start_time: "2026-03-12T10:00:00.000Z",
      end_time: "2026-03-12T10:00:01.000Z",
      status_code: "ok",
      payload: { orderId: "ord_1" },
      payload_masking_applied: true,
      payload_masked_fields: ["cc_number"],
    });

    const graph = reconstruct("trace_1", [record]);
    const node = graph.nodes[0];

    expect(node.id).toBe("log_x");
    expect(node.log_id).toBe("log_x");
    expect(node.event_key).toBe("order.placed");
    expect(node.event_version).toBe("002");
    expect(node.record_kind).toBe("span");
    expect(node.span_name).toBe("place_order");
    expect(node.start_time).toBe("2026-03-12T10:00:00.000Z");
    expect(node.end_time).toBe("2026-03-12T10:00:01.000Z");
    expect(node.status_code).toBe("ok");
    expect(node.payload).toEqual({ orderId: "ord_1" });
    expect(node.payload_masking_applied).toBe(true);
    expect(node.payload_masked_fields).toEqual(["cc_number"]);
  });
});
