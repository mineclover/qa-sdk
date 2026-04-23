// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { describe, expect, it, vi } from "vitest";
import { GraphExplorerController } from "./graph-explorer.controller.js";
import { GraphExplorerService } from "./graph-explorer.service.js";

describe("GraphExplorerController", () => {
  it("GET /audit/graphs/:graphId/latest returns snapshot", async () => {
    const svc = {
      latest: vi.fn(async () => ({
        graphId: "delegation-1",
        snapshotId: "delegation-1:001",
        createdAt: "2026-04-24T00:00:00.000Z",
        graph: { realms: [], nodes: [], relations: [] },
      })),
      getSnapshot: vi.fn(),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.latest("delegation-1");
    expect(result.snapshotId).toBe("delegation-1:001");
  });

  it("GET /audit/graphs/:graphId/latest not found -> NotFoundException", async () => {
    const svc = {
      latest: vi.fn(async () => null),
      getSnapshot: vi.fn(),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    await expect(ctrl.latest("missing")).rejects.toMatchObject({
      response: { error: "graph_not_found", graphId: "missing" },
    });
  });
});
