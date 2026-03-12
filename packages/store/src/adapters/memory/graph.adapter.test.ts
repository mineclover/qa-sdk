import { describe, expect, it } from "vitest";
import type { RuntimeGraph } from "@qa-sdk/core";
import { InMemoryGraphStore } from "./graph.adapter.js";

function buildGraph(edgeTo = "node_2"): RuntimeGraph {
  return {
    trace_id: "trace_1",
    nodes: [
      {
        id: "node_1",
        log_id: "log_1",
        timestamp: "2026-03-12T00:00:00.000Z",
        record_kind: "log",
        event_key: "user_signed_in",
        event_version: "001",
        payload: { ok: true },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
      {
        id: "node_2",
        log_id: "log_2",
        timestamp: "2026-03-12T00:00:01.000Z",
        record_kind: "log",
        event_key: "checkout_completed",
        event_version: "001",
        payload: { ok: true },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    edges: [{ from: "node_1", to: edgeTo, type: "temporal" }],
  };
}

describe("InMemoryGraphStore", () => {
  it("upserts and retrieves graphs by trace id", async () => {
    const store = new InMemoryGraphStore();

    await store.upsert("trace_1", buildGraph());
    await expect(store.findByTraceId("trace_1")).resolves.toEqual(buildGraph());

    await store.upsert("trace_1", buildGraph("node_1"));
    await expect(store.findByTraceId("trace_1")).resolves.toEqual(
      buildGraph("node_1"),
    );
    await expect(store.findByTraceId("missing")).resolves.toBeNull();
  });
});
