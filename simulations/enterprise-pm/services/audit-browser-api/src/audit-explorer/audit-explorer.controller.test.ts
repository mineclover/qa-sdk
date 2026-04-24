// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it, vi } from "vitest";
import { AuditExplorerController } from "./audit-explorer.controller.js";
import { AuditExplorerService } from "./audit-explorer.service.js";
import { GraphExplorerService } from "../graph-explorer/graph-explorer.service.js";
import { GraphRetentionInsightService } from "../graph-explorer/graph-retention-insight.service.js";
import type { AuditRecorder } from "permission-engine";

function makeMockRecorder(
  overrides: Partial<AuditRecorder> = {},
): AuditRecorder {
  return {
    listByRoot: vi.fn(async () => []),
    firstFailure: vi.fn(async () => null),
    get: vi.fn(async () => null),
    startExecution: vi.fn(async () => ({}) as never),
    finishExecution: vi.fn(async () => ({}) as never),
    recordCheck: vi.fn(async () => ({}) as never),
    ...overrides,
  };
}

function makeMockGraphExplorer(
  overrides: Partial<GraphExplorerService> = {},
): GraphExplorerService {
  return {
    latest: vi.fn(async () => null),
    list: vi.fn(async () => []),
    getSnapshot: vi.fn(async () => null),
    diff: vi.fn(async () => null),
    ...overrides,
  } as unknown as GraphExplorerService;
}

function makeMockRetentionInsight(
  overrides: Partial<GraphRetentionInsightService> = {},
): GraphRetentionInsightService {
  return {
    getForGraph: vi.fn(async () => null),
    ...overrides,
  } as unknown as GraphRetentionInsightService;
}

describe("AuditExplorerController", () => {
  it("GET /audit/trace/:id — count + entries 응답", async () => {
    const rec = makeMockRecorder({
      listByRoot: vi.fn(async () => [
        {
          kind: "execution",
          spanId: "x",
          traceId: "t",
          parentSpanId: null,
          rootSpanId: "x",
          depth: 0,
          apiId: "api",
          actorUserId: "u",
          actorTenantId: null,
          targetKind: "r",
          targetId: "r1",
          outcome: "allow",
          startedAt: "2026-04-22T00:00:00Z",
          endedAt: null,
          metadata: null,
        } as never,
      ]),
    });
    const svc = new AuditExplorerService(rec);
    const ctrl = new AuditExplorerController(
      svc,
      makeMockGraphExplorer(),
      makeMockRetentionInsight(),
    );
    const result = await ctrl.trace("x");
    expect(result.count).toBe(1);
    expect(result.rootSpanId).toBe("x");
  });

  it("GET /audit/entry/:id (미존재) → NotFoundException", async () => {
    const rec = makeMockRecorder({ get: vi.fn(async () => null) });
    const svc = new AuditExplorerService(rec);
    const ctrl = new AuditExplorerController(
      svc,
      makeMockGraphExplorer(),
      makeMockRetentionInsight(),
    );
    try {
      await ctrl.entry("nope");
      throw new Error("should have thrown");
    } catch (err) {
      // NestJS NotFoundException.response.error === "not_found"
      const response = (err as { response?: { error?: string } }).response;
      expect(response?.error).toBe("not_found");
    }
  });

  it("GET /audit/context/:root/:graph returns combined trace + graph snapshot", async () => {
    const rec = makeMockRecorder({
      listByRoot: vi.fn(async () => [
        {
          kind: "execution",
          spanId: "root-1",
          traceId: "t1",
          parentSpanId: null,
          rootSpanId: "root-1",
          depth: 0,
          apiId: "api",
          actorUserId: "u",
          actorTenantId: null,
          targetKind: "resource",
          targetId: "r1",
          outcome: "allow",
          startedAt: "2026-04-22T00:00:00Z",
          endedAt: null,
          metadata: null,
        } as never,
      ]),
      firstFailure: vi.fn(async () => null),
    });
    const svc = new AuditExplorerService(rec);
    const ctrl = new AuditExplorerController(
      svc,
      makeMockGraphExplorer({
        latest: vi.fn(async () => ({
          graphId: "graph-1",
          snapshotId: "graph-1:001",
          createdAt: "2026-04-24T00:00:00.000Z",
          graph: { realms: [], nodes: [], relations: [] },
        })),
      }),
      makeMockRetentionInsight({
        getForGraph: vi.fn(async () => ({
          total: 1,
          summary: { "sim.graph_retention.graph_pruned": 1 },
          byTrigger: { api: 1 },
          byGraphId: { "graph-1": 1 },
          items: [],
        })),
      }),
    );
    const result = await ctrl.context("root-1", "graph-1");
    expect(result.trace.count).toBe(1);
    expect(result.graphSnapshot.snapshotId).toBe("graph-1:001");
    expect(result.firstFailure).toBeNull();
    expect(result.graphRetentionInsight?.total).toBe(1);
  });
});
