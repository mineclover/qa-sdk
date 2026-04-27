// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { AuditTraceController } from "./audit-trace.controller.js";
import { AuditTraceBff } from "./audit-trace.bff.js";

function makeBff(overrides: Partial<AuditTraceBff> = {}): AuditTraceBff {
  return {
    cachePrefix: "audit-explorer-bff-trace:v1",
    getTrace: vi.fn(async () => ({
      rootSpanId: "exec-1",
      count: 0,
      entries: [],
      cacheKey: "audit-explorer-bff-trace:v1:exec-1",
    })),
    getFirstFailure: vi.fn(async () => ({
      rootSpanId: "exec-1",
      firstFailure: null,
      cacheKey: "audit-explorer-bff-trace:v1:first-failure:exec-1",
    })),
    getEntry: vi.fn(async () => null),
    getContext: vi.fn(async () => null),
    ...overrides,
  } as unknown as AuditTraceBff;
}

describe("AuditTraceController", () => {
  it("GET /audit/trace/:rootSpanId — count + entries 응답 (기존 shape 보존)", async () => {
    const bff = makeBff({
      getTrace: vi.fn(async () => ({
        rootSpanId: "exec-1",
        count: 1,
        entries: [{ spanId: "exec-1" }] as never,
        cacheKey: "k",
      })),
    });
    const ctrl = new AuditTraceController(bff);
    const result = await ctrl.trace("exec-1", "trc_a", "cor_a");
    expect(result).toEqual({
      rootSpanId: "exec-1",
      count: 1,
      entries: [{ spanId: "exec-1" }],
    });
    expect(bff.getTrace).toHaveBeenCalledWith({
      rootSpanId: "exec-1",
      traceId: "trc_a",
      correlationId: "cor_a",
    });
  });

  it("GET /audit/firstFailure/:rootSpanId — 응답 shape", async () => {
    const ctrl = new AuditTraceController(makeBff());
    const result = await ctrl.firstFailure("exec-1");
    expect(result).toEqual({ rootSpanId: "exec-1", firstFailure: null });
  });

  it("GET /audit/entry/:spanId (미존재) → NotFoundException", async () => {
    const ctrl = new AuditTraceController(makeBff({ getEntry: vi.fn(async () => null) }));
    try {
      await ctrl.entry("nope");
      throw new Error("should have thrown");
    } catch (err) {
      const response = (err as { response?: { error?: string } }).response;
      expect(response?.error).toBe("not_found");
    }
  });

  it("GET /audit/context/:root/:graph — 4 read 합성 응답", async () => {
    const bff = makeBff({
      getContext: vi.fn(async () => ({
        rootSpanId: "exec-1",
        graphId: "graph-1",
        trace: { count: 1, entries: [{ spanId: "x" }] as never },
        firstFailure: null,
        graphSnapshot: {
          graphId: "graph-1",
          snapshotId: "graph-1:001",
          createdAt: "2026-04-24T00:00:00.000Z",
          graph: { realms: [], nodes: [], relations: [] },
        } as never,
        graphRetentionInsight: {
          total: 1,
          summary: { "sim.graph_retention.graph_pruned": 1 },
          byTrigger: { api: 1 },
          byGraphId: { "graph-1": 1 },
          items: [],
        },
        cacheKey: "k",
      })),
    });
    const ctrl = new AuditTraceController(bff);
    const result = await ctrl.context("exec-1", "graph-1", "trc", "cor");
    expect(result.trace.count).toBe(1);
    expect((result.graphSnapshot as { snapshotId: string }).snapshotId).toBe("graph-1:001");
    expect(result.firstFailure).toBeNull();
    expect(result.graphRetentionInsight?.total).toBe(1);
  });

  it("GET /audit/context (graph 미존재) → graph_not_found NotFoundException", async () => {
    const ctrl = new AuditTraceController(makeBff({ getContext: vi.fn(async () => null) }));
    try {
      await ctrl.context("exec-1", "missing");
      throw new Error("should have thrown");
    } catch (err) {
      const response = (err as { response?: { error?: string; graphId?: string } }).response;
      expect(response?.error).toBe("graph_not_found");
      expect(response?.graphId).toBe("missing");
    }
  });
});
