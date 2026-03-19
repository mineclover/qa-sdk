import { describe, expect, it, vi } from "vitest";
import type {
  DlqInsert,
  DlqStore,
  GraphStore,
  RecordStore,
  RuntimeGraph,
  StoredRecord,
  StoredTrace,
  TraceStore,
} from "@qa-sdk/core";
import { reconstructPendingTraces, reconstructTrace } from "./reconstruct-pending-traces.js";

function makeTrace(traceId: string, overrides: Partial<StoredTrace> = {}): StoredTrace {
  const {
    actorId = null,
    userAttributes = null,
    userId = null,
    ...restOverrides
  } = overrides;

  return {
    traceId,
    sessionId: null,
    serviceName: null,
    actorId,
    userId,
    userAttributes,
    recordCount: 1,
    firstTimestamp: new Date("2026-03-13T00:00:00.000Z"),
    lastTimestamp: new Date("2026-03-13T00:00:01.000Z"),
    reconstructed: false,
    createdAt: new Date("2026-03-13T00:00:00.000Z"),
    updatedAt: new Date("2026-03-13T00:00:00.000Z"),
    ...restOverrides,
  };
}

function makeRecord(traceId: string): StoredRecord {
  return {
    logId: `log_${traceId}`,
    traceId,
    spanId: `spn_${traceId}`,
    parentSpanId: undefined,
    timestamp: new Date("2026-03-13T00:00:00.000Z"),
    recordKind: "log",
    eventKey: "page_view",
    eventVersion: "1",
    spanName: undefined,
    startTime: undefined,
    endTime: undefined,
    statusCode: undefined,
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: {},
    qaSessionId: undefined,
    registryWarning: undefined,
    createdAt: new Date("2026-03-13T00:00:00.000Z"),
  };
}

function buildDeps(traces: StoredTrace[] = [], records: Map<string, StoredRecord[]> = new Map()) {
  const graphs = new Map<string, RuntimeGraph>();
  const dlqItems: DlqInsert[] = [];
  const reconstructedIds: string[] = [];

  const recordStore: Pick<RecordStore, "findByTraceId"> = {
    findByTraceId: vi.fn().mockImplementation(async (traceId: string) => records.get(traceId) ?? []),
  };

  const traceStore: Pick<TraceStore, "findById" | "findUnreconstructed" | "markReconstructed"> = {
    findById: vi.fn().mockImplementation(async (traceId: string) =>
      traces.find((t) => t.traceId === traceId) ?? null,
    ),
    findUnreconstructed: vi.fn().mockResolvedValue(traces),
    markReconstructed: vi.fn().mockImplementation(async (traceId: string) => {
      reconstructedIds.push(traceId);
    }),
  };

  const graphStore: GraphStore = {
    upsert: vi.fn().mockImplementation(async (traceId: string, graph: RuntimeGraph) => {
      graphs.set(traceId, graph);
    }),
    findByTraceId: vi.fn().mockImplementation(async (traceId: string) => graphs.get(traceId) ?? null),
  };

  const dlqStore: Pick<DlqStore, "insert"> = {
    insert: vi.fn().mockImplementation(async (item: DlqInsert) => {
      dlqItems.push(item);
    }),
  };

  return { recordStore, traceStore, graphStore, dlqStore, graphs, dlqItems, reconstructedIds };
}

describe("reconstructPendingTraces", () => {
  it("returns empty results when no unreconstructed traces exist", async () => {
    const deps = buildDeps([]);
    const result = await reconstructPendingTraces(deps);
    expect(result.reconstructedTraceIds).toEqual([]);
    expect(result.failedTraceIds).toEqual([]);
  });

  it("reconstructs a pending trace and marks it as reconstructed", async () => {
    const traceId = "trc_001";
    const records = new Map([[traceId, [makeRecord(traceId)]]]);
    const deps = buildDeps([makeTrace(traceId)], records);

    const result = await reconstructPendingTraces(deps);

    expect(result.reconstructedTraceIds).toEqual([traceId]);
    expect(result.failedTraceIds).toEqual([]);
    expect(deps.graphs.get(traceId)).toBeDefined();
    expect(deps.reconstructedIds).toContain(traceId);
  });

  it("reconstructs multiple pending traces", async () => {
    const traces = ["trc_001", "trc_002"].map((id) => makeTrace(id));
    const records = new Map([
      ["trc_001", [makeRecord("trc_001")]],
      ["trc_002", [makeRecord("trc_002")]],
    ]);
    const deps = buildDeps(traces, records);

    const result = await reconstructPendingTraces(deps);

    expect(result.reconstructedTraceIds).toHaveLength(2);
    expect(result.reconstructedTraceIds).toContain("trc_001");
    expect(result.reconstructedTraceIds).toContain("trc_002");
  });

  it("targets specific trace IDs and skips already reconstructed traces", async () => {
    const traces = [
      makeTrace("trc_001"),
      makeTrace("trc_002", { reconstructed: true }),
      makeTrace("trc_003"),
    ];
    const records = new Map([
      ["trc_001", [makeRecord("trc_001")]],
      ["trc_002", [makeRecord("trc_002")]],
      ["trc_003", [makeRecord("trc_003")]],
    ]);
    const deps = buildDeps(traces, records);

    const result = await reconstructPendingTraces(deps, {
      traceIds: ["trc_003", "trc_002", "trc_003"],
    });

    expect(result.reconstructedTraceIds).toEqual(["trc_003"]);
    expect(result.failedTraceIds).toEqual([]);
    expect(deps.reconstructedIds).toEqual(["trc_003"]);
    expect(deps.traceStore.findUnreconstructed).not.toHaveBeenCalled();
  });

  it("adds to DLQ and calls onError when reconstruction fails", async () => {
    const traceId = "trc_fail";
    const deps = buildDeps([makeTrace(traceId)]);
    (deps.recordStore.findByTraceId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db error"));

    const onError = vi.fn();
    const result = await reconstructPendingTraces(deps, { onError });

    expect(result.failedTraceIds).toEqual([traceId]);
    expect(result.reconstructedTraceIds).toEqual([]);
    expect(onError).toHaveBeenCalledWith(traceId, expect.any(Error));
    expect(deps.dlqItems).toHaveLength(1);
    expect(deps.dlqItems[0]?.phase).toBe("reconstruction");
    expect(deps.dlqItems[0]?.traceId).toBe(traceId);
  });

  it("handles partial failure: reconstructs successful traces even when one fails", async () => {
    const traces = ["trc_001", "trc_fail"].map((id) => makeTrace(id));
    const records = new Map([["trc_001", [makeRecord("trc_001")]]]);
    const deps = buildDeps(traces, records);
    (deps.recordStore.findByTraceId as ReturnType<typeof vi.fn>).mockImplementation(
      async (traceId: string) => {
        if (traceId === "trc_fail") throw new Error("db error");
        return records.get(traceId) ?? [];
      },
    );

    const result = await reconstructPendingTraces(deps);

    expect(result.reconstructedTraceIds).toContain("trc_001");
    expect(result.failedTraceIds).toContain("trc_fail");
  });

  it("does not throw when no onError callback is provided and reconstruction fails", async () => {
    const traceId = "trc_fail";
    const deps = buildDeps([makeTrace(traceId)]);
    (deps.recordStore.findByTraceId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db error"));

    const result = await reconstructPendingTraces(deps);

    expect(result.failedTraceIds).toContain(traceId);
    expect(deps.dlqItems).toHaveLength(1);
  });

  it("can suppress DLQ writes when the caller handles final failure elsewhere", async () => {
    const traceId = "trc_fail";
    const deps = buildDeps([makeTrace(traceId)]);
    (deps.recordStore.findByTraceId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db error"));

    const result = await reconstructPendingTraces(deps, {
      captureFailuresInDlq: false,
    });

    expect(result.failedTraceIds).toEqual([traceId]);
    expect(deps.dlqItems).toEqual([]);
  });
});

describe("reconstructTrace", () => {
  it("stores the graph and marks the trace as reconstructed", async () => {
    const traceId = "trc_001";
    const records = new Map([[traceId, [makeRecord(traceId)]]]);
    const deps = buildDeps([makeTrace(traceId)], records);

    await reconstructTrace(deps, traceId);

    expect(deps.graphs.get(traceId)?.trace_id).toBe(traceId);
    expect(deps.reconstructedIds).toContain(traceId);
  });
});
