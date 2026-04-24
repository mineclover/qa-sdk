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
      list: vi.fn(),
      getSnapshot: vi.fn(),
      diff: vi.fn(),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.latest("delegation-1");
    expect(result.snapshotId).toBe("delegation-1:001");
  });

  it("GET /audit/graphs/:graphId/latest not found -> NotFoundException", async () => {
    const svc = {
      latest: vi.fn(async () => null),
      list: vi.fn(),
      getSnapshot: vi.fn(),
      diff: vi.fn(),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    await expect(ctrl.latest("missing")).rejects.toMatchObject({
      response: { error: "graph_not_found", graphId: "missing" },
    });
  });

  it("GET /audit/graphs/:graphId lists snapshots", async () => {
    const svc = {
      latest: vi.fn(),
      list: vi.fn(async () => [{ snapshotId: "s1" }, { snapshotId: "s2" }]),
      getSnapshot: vi.fn(),
      diff: vi.fn(),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.list("delegation-1");
    expect(result.count).toBe(2);
  });

  it("GET /audit/graphs/catalog lists graph ids", async () => {
    const svc = {
      graphIds: vi.fn(async () => ["delegation-1", "delegation-2"]),
      latest: vi.fn(),
      list: vi.fn(),
      getSnapshot: vi.fn(),
      diff: vi.fn(),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.catalog();
    expect(result.count).toBe(2);
    expect(result.graphIds).toEqual(["delegation-1", "delegation-2"]);
  });

  it("GET /audit/graphs/diff/:from/:to returns diff", async () => {
    const svc = {
      latest: vi.fn(),
      list: vi.fn(),
      getSnapshot: vi.fn(),
      diff: vi.fn(async () => ({
        fromSnapshotId: "s1",
        toSnapshotId: "s2",
        summary: {
          nodeCountDelta: 1,
          relationCountDelta: 0,
          realmCountDelta: 0,
          addedNodeCount: 1,
          removedNodeCount: 0,
          addedRelationCount: 0,
          removedRelationCount: 0,
          addedRealmCount: 0,
          removedRealmCount: 0,
        },
        addedNodeIds: ["n1"],
        removedNodeIds: [],
        addedRelationIds: [],
        removedRelationIds: [],
        addedRealmIds: [],
        removedRealmIds: [],
      })),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.diff("s1", "s2");
    expect(result.summary.addedNodeCount).toBe(1);
  });

  it("DELETE /audit/graphs/prune/:keepLatest prunes all graphs", async () => {
    const svc = {
      latest: vi.fn(),
      list: vi.fn(),
      getSnapshot: vi.fn(),
      diff: vi.fn(),
      pruneAll: vi.fn(async () => ({
        keepLatest: 1,
        graphIds: ["delegation-1", "delegation-2"],
        graphCount: 2,
        beforeCount: 4,
        afterCount: 2,
        deletedSnapshotIds: ["s1", "s3"],
        graphs: [],
      })),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.pruneAll("1");
    expect(result.graphCount).toBe(2);
    expect(result.deletedSnapshotIds).toEqual(["s1", "s3"]);
  });

  it("DELETE /audit/graphs/:graphId/prune/:keepLatest prunes snapshots", async () => {
    const svc = {
      latest: vi.fn(),
      list: vi.fn(),
      getSnapshot: vi.fn(),
      diff: vi.fn(),
      prune: vi.fn(async () => ({
        graphId: "delegation-1",
        beforeCount: 3,
        afterCount: 1,
        deletedSnapshotIds: ["s1", "s2"],
        keptSnapshotIds: ["s3"],
      })),
    } as unknown as GraphExplorerService;
    const ctrl = new GraphExplorerController(svc);
    const result = await ctrl.prune("delegation-1", "1");
    expect(result.afterCount).toBe(1);
    expect(result.deletedSnapshotIds).toEqual(["s1", "s2"]);
  });
});
