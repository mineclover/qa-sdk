// @def.boundary ingest-system
// @def.doc ingest-system

import type { GraphStore } from "@qa-sdk/core";
import type { RuntimeGraph } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

function makeGraph(overrides: Partial<RuntimeGraph> = {}): RuntimeGraph {
  return {
    trace_id: "t1",
    nodes: [
      {
        id: "n1",
        log_id: "r1",
        timestamp: "2026-01-01T00:00:00Z",
        record_kind: "log",
        event_key: "page.view",
        event_version: "001",
        payload: { page: "home" },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    edges: [
      { source: "n1", target: "n2", type: "temporal" },
    ],
    ...overrides,
  };
}

export function graphStoreTests(
  factory: () => Promise<{ store: GraphStore; cleanup: () => Promise<void> }>,
) {
  let store: GraphStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("upsert + findByTraceId JSON 라운드트립", async () => {
    const graph = makeGraph();
    await store.upsert("t1", graph);
    const result = await store.findByTraceId("t1");
    expect(result).not.toBeNull();
    expect(result!.trace_id).toBe("t1");
    expect(result!.nodes).toHaveLength(1);
    expect(result!.edges).toHaveLength(1);
    expect(result!.nodes[0].event_key).toBe("page.view");
  });

  it("upsert 덮어쓰기", async () => {
    await store.upsert("t1", makeGraph({ nodes: [], edges: [] }));
    const updatedGraph = makeGraph({
      nodes: [
        {
          id: "n1",
          log_id: "r1",
          timestamp: "2026-01-01T00:00:00Z",
          record_kind: "log",
          event_key: "page.view",
          event_version: "001",
          payload: {},
          payload_masking_applied: false,
          payload_masked_fields: [],
        },
        {
          id: "n2",
          log_id: "r2",
          timestamp: "2026-01-01T00:00:01Z",
          record_kind: "log",
          event_key: "cart.add",
          event_version: "001",
          payload: {},
          payload_masking_applied: false,
          payload_masked_fields: [],
        },
      ],
      edges: [],
    });
    await store.upsert("t1", updatedGraph);
    const result = await store.findByTraceId("t1");
    expect(result!.nodes).toHaveLength(2);
  });

  it("findByTraceId 미존재 → null", async () => {
    const result = await store.findByTraceId("nonexistent");
    expect(result).toBeNull();
  });

  it("upsert JSON 복잡 객체 라운드트립", async () => {
    const complexGraph = makeGraph({
      nodes: [
        {
          id: "n1",
          log_id: "r1",
          timestamp: "2026-01-01T00:00:00Z",
          record_kind: "log",
          event_key: "page.view",
          event_version: "001",
          payload: { eventKey: "page.view", nested: { deep: true } },
          payload_masking_applied: false,
          payload_masked_fields: [],
        },
        {
          id: "n2",
          log_id: "r2",
          timestamp: "2026-01-01T00:00:01Z",
          record_kind: "log",
          event_key: "checkout",
          event_version: "001",
          payload: { spanName: "checkout" },
          payload_masking_applied: false,
          payload_masked_fields: [],
        },
      ],
      edges: [
        { source: "n1", target: "n2", type: "parent_child" },
      ],
    });
    await store.upsert("t1", complexGraph);
    const result = await store.findByTraceId("t1");
    expect(result).not.toBeNull();
    expect(result!.nodes).toHaveLength(2);
    expect((result!.nodes[0].payload as Record<string, unknown>).nested).toEqual({ deep: true });
  });
}
