// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { describe, expect, it } from "vitest";
import { InMemoryAuthorizationGraphStore } from "authorization-ontology";
import { GraphExplorerService } from "./graph-explorer.service.js";

describe("GraphExplorerService", () => {
  it("returns latest snapshot for a graph id", async () => {
    const store = new InMemoryAuthorizationGraphStore();
    await store.saveSnapshot({
      graphId: "delegation-1",
      snapshotId: "delegation-1:001",
      createdAt: "2026-04-24T00:00:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "delegation-1",
      snapshotId: "delegation-1:002",
      createdAt: "2026-04-24T00:01:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });

    const svc = new GraphExplorerService(store);
    const latest = await svc.latest("delegation-1");
    expect(latest?.snapshotId).toBe("delegation-1:002");
  });
});
