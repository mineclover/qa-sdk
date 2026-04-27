// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { GraphCatalogController } from "./graph-catalog.controller.js";
import { GraphCatalogBff } from "./graph-catalog.bff.js";

function makeBff(overrides: Partial<GraphCatalogBff> = {}): GraphCatalogBff {
  return {
    cachePrefix: "graph-explorer-bff-catalog:v1",
    getCatalog: vi.fn(async () => ({ count: 0, graphIds: [], cacheKey: "" })),
    getLatest: vi.fn(async () => null),
    listSnapshots: vi.fn(async () => ({
      graphId: "g1",
      count: 0,
      snapshots: [],
      cacheKey: "",
    })),
    getSnapshot: vi.fn(async () => null),
    getDiff: vi.fn(async () => null),
    prune: vi.fn(),
    pruneAll: vi.fn(),
    ...overrides,
  } as unknown as GraphCatalogBff;
}

describe("GraphCatalogController", () => {
  it("GET /audit/graphs/catalog returns count + graphIds", async () => {
    const ctrl = new GraphCatalogController(
      makeBff({
        getCatalog: vi.fn(async () => ({
          count: 2,
          graphIds: ["g1", "g2"],
          cacheKey: "k",
        })),
      }),
    );
    const result = await ctrl.catalog("trc", "cor");
    expect(result).toEqual({ count: 2, graphIds: ["g1", "g2"] });
  });

  it("GET /audit/graphs/:graphId/latest 미존재 → graph_not_found", async () => {
    const ctrl = new GraphCatalogController(makeBff({ getLatest: vi.fn(async () => null) }));
    await expect(ctrl.latest("missing")).rejects.toMatchObject({
      response: { error: "graph_not_found", graphId: "missing" },
    });
  });

  it("GET /audit/graphs/:graphId/latest 응답 = snapshot", async () => {
    const ctrl = new GraphCatalogController(
      makeBff({
        getLatest: vi.fn(async () => ({
          graphId: "delegation-1",
          snapshotId: "delegation-1:001",
          createdAt: "2026-04-24T00:00:00.000Z",
          graph: { realms: [], nodes: [], relations: [] },
        }) as never),
      }),
    );
    const result = await ctrl.latest("delegation-1");
    expect((result as { snapshotId: string }).snapshotId).toBe("delegation-1:001");
  });

  it("GET /audit/graphs/:graphId — snapshots count 응답", async () => {
    const ctrl = new GraphCatalogController(
      makeBff({
        listSnapshots: vi.fn(async () => ({
          graphId: "g1",
          count: 2,
          snapshots: [{ snapshotId: "s1" }, { snapshotId: "s2" }] as never,
          cacheKey: "k",
        })),
      }),
    );
    const result = await ctrl.list("g1");
    expect(result.count).toBe(2);
  });

  it("GET /audit/graphs/diff/:from/:to 응답 = diff", async () => {
    const diff = {
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
    };
    const ctrl = new GraphCatalogController(
      makeBff({ getDiff: vi.fn(async () => diff as never) }),
    );
    const result = await ctrl.diff("s1", "s2");
    expect((result as typeof diff).summary.addedNodeCount).toBe(1);
  });

  it("DELETE /audit/graphs/:graphId/prune/:keepLatest 응답", async () => {
    const ctrl = new GraphCatalogController(
      makeBff({
        prune: vi.fn(async () => ({
          graphId: "g1",
          beforeCount: 3,
          afterCount: 1,
          deletedSnapshotIds: ["s1", "s2"],
          keptSnapshotIds: ["s3"],
        })) as never,
      }),
    );
    const result = await ctrl.prune("g1", "1");
    expect(result.afterCount).toBe(1);
    expect(result.deletedSnapshotIds).toEqual(["s1", "s2"]);
  });

  it("DELETE /audit/graphs/prune/:keepLatest 응답", async () => {
    const ctrl = new GraphCatalogController(
      makeBff({
        pruneAll: vi.fn(async () => ({
          keepLatest: 1,
          graphIds: ["g1", "g2"],
          graphCount: 2,
          beforeCount: 4,
          afterCount: 2,
          deletedSnapshotIds: ["s1", "s3"],
          graphs: [],
        })) as never,
      }),
    );
    const result = await ctrl.pruneAll("1");
    expect(result.graphCount).toBe(2);
    expect(result.deletedSnapshotIds).toEqual(["s1", "s3"]);
  });

  it("DELETE /audit/graphs/prune/:keepLatest — invalid keepLatest → 404", async () => {
    const ctrl = new GraphCatalogController(makeBff());
    await expect(ctrl.pruneAll("not-a-number")).rejects.toMatchObject({
      response: { error: "invalid_keep_latest" },
    });
  });
});
