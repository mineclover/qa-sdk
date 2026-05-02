// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import type { LoggerPort } from "@qa-sdk/sim-domain-slice-kit";
import { GraphCatalogBff } from "./graph-catalog.bff.js";
import { GraphStoreQueryPort } from "../../application/ports/graph-store-query.port.js";

class FakeGraphs extends GraphStoreQueryPort {
  latestSpy = vi.fn();
  listSpy = vi.fn();
  graphIdsSpy = vi.fn();
  getSnapshotSpy = vi.fn();
  diffSpy = vi.fn();
  pruneSpy = vi.fn();
  pruneAllSpy = vi.fn();
  async latest(graphId: string) {
    return this.latestSpy(graphId);
  }
  async list(graphId: string) {
    return this.listSpy(graphId);
  }
  async getSnapshot(snapshotId: string) {
    return this.getSnapshotSpy(snapshotId);
  }
  async graphIds() {
    return this.graphIdsSpy();
  }
  async diff(a: string, b: string) {
    return this.diffSpy(a, b);
  }
  async prune(graphId: string, keepLatest: number) {
    return this.pruneSpy(graphId, keepLatest);
  }
  async pruneAll(keepLatest: number) {
    return this.pruneAllSpy(keepLatest);
  }
}

function makeLogger(): { logger: LoggerPort; logged: Array<{ ctx: Record<string, unknown>; msg: string }> } {
  const logged: Array<{ ctx: Record<string, unknown>; msg: string }> = [];
  return {
    logger: {
      info: (ctx, msg) => logged.push({ ctx: ctx as never, msg }),
      warn: (ctx, msg) => logged.push({ ctx: ctx as never, msg }),
      error: (ctx, msg) => logged.push({ ctx: ctx as never, msg }),
    },
    logged,
  };
}

describe("GraphCatalogBff", () => {
  it("getCatalog — graphIds + cacheKey", async () => {
    const graphs = new FakeGraphs();
    graphs.graphIdsSpy.mockResolvedValueOnce(["g1", "g2"]);
    const { logger, logged } = makeLogger();
    const bff = new GraphCatalogBff(graphs, logger);
    const result = await bff.getCatalog({ traceId: "t", correlationId: "c" });
    expect(result.count).toBe(2);
    expect(result.graphIds).toEqual(["g1", "g2"]);
    expect(result.cacheKey).toBe("graph-explorer-bff-catalog:v1:catalog");
    const log = logged.find((l) => l.msg === "graph-catalog.bff.success")!;
    expect(log.ctx).toMatchObject({
      domain: "graph-explorer",
      useCase: "GraphCatalogBff.getCatalog",
      cacheKeyPrefix: "graph-explorer-bff-catalog:v1",
    });
  });

  it("getLatest — snapshot 미존재 시 outcome=failure", async () => {
    const graphs = new FakeGraphs();
    graphs.latestSpy.mockResolvedValueOnce(null);
    const { logger, logged } = makeLogger();
    const bff = new GraphCatalogBff(graphs, logger);
    const result = await bff.getLatest({ graphId: "missing", traceId: "t", correlationId: "c" });
    expect(result).toBeNull();
    const log = logged.find((l) => l.msg === "graph-catalog.bff.latest.miss")!;
    expect(log.ctx.outcome).toBe("failure");
  });

  it("listSnapshots — count + snapshots + cacheKey", async () => {
    const graphs = new FakeGraphs();
    graphs.listSpy.mockResolvedValueOnce([{ snapshotId: "s1" }, { snapshotId: "s2" }]);
    const { logger } = makeLogger();
    const bff = new GraphCatalogBff(graphs, logger);
    const result = await bff.listSnapshots({ graphId: "g1", traceId: "t", correlationId: "c" });
    expect(result.count).toBe(2);
    expect(result.cacheKey).toBe("graph-explorer-bff-catalog:v1:list:g1");
  });

  it("getDiff — null 시 outcome=failure", async () => {
    const graphs = new FakeGraphs();
    graphs.diffSpy.mockResolvedValueOnce(null);
    const { logger, logged } = makeLogger();
    const bff = new GraphCatalogBff(graphs, logger);
    const result = await bff.getDiff({
      fromSnapshotId: "s1",
      toSnapshotId: "s2",
      traceId: "t",
      correlationId: "c",
    });
    expect(result).toBeNull();
    expect(logged.find((l) => l.msg === "graph-catalog.bff.diff.miss")?.ctx.outcome).toBe("failure");
  });

  it("prune — retention 이벤트 로깅 (eventKey + addressContext)", async () => {
    const graphs = new FakeGraphs();
    graphs.pruneSpy.mockResolvedValueOnce({
      graphId: "g1",
      beforeCount: 3,
      afterCount: 1,
      deletedSnapshotIds: ["s1", "s2"],
      keptSnapshotIds: ["s3"],
    });
    const { logger, logged } = makeLogger();
    const bff = new GraphCatalogBff(graphs, logger);
    const result = await bff.prune({ graphId: "g1", keepLatest: 1, traceId: "t", correlationId: "c" });
    expect(result.afterCount).toBe(1);
    const log = logged.find((l) => l.msg === "graph retention prune requested via API")!;
    expect(log.ctx.eventKey).toBe("sim.graph_retention.graph_pruned");
    expect((log.ctx.addressContext as { graph: string }).graph).toBe("authorization_graph:v1:g1");
  });

  it("pruneAll — sweep 이벤트 로깅", async () => {
    const graphs = new FakeGraphs();
    graphs.pruneAllSpy.mockResolvedValueOnce({
      keepLatest: 1,
      graphIds: ["g1", "g2"],
      graphCount: 2,
      beforeCount: 4,
      afterCount: 2,
      deletedSnapshotIds: ["s1", "s3"],
      graphs: [],
    });
    const { logger, logged } = makeLogger();
    const bff = new GraphCatalogBff(graphs, logger);
    const result = await bff.pruneAll({ keepLatest: 1, traceId: "t", correlationId: "c" });
    expect(result.graphCount).toBe(2);
    expect(result.deletedSnapshotIds).toEqual(["s1", "s3"]);
    const log = logged.find((l) => l.msg === "graph retention sweep requested via API")!;
    expect(log.ctx.eventKey).toBe("sim.graph_retention.sweep");
  });

  it("cachePrefix 가 OM seed 와 일치한다", () => {
    const { logger } = makeLogger();
    const bff = new GraphCatalogBff(new FakeGraphs(), logger);
    expect(bff.cachePrefix).toBe("graph-explorer-bff-catalog:v1");
  });
});
