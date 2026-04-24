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

  it("lists snapshots and computes diffs", async () => {
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
      graph: {
        realms: [],
        nodes: [{ nodeId: "n-1", kind: "principal", coord: { realm: "r", space: "principal", anchor: "a", taxonomies: {}, canonicalKey: "n-1" }, metadata: {} }],
        relations: [],
      },
    });

    const svc = new GraphExplorerService(store);
    const snapshots = await svc.list("delegation-1");
    expect(snapshots).toHaveLength(2);

    const diff = await svc.diff("delegation-1:001", "delegation-1:002");
    expect(diff?.summary.addedNodeCount).toBe(1);
    expect(diff?.toSnapshotId).toBe("delegation-1:002");
  });

  it("prunes older snapshots and keeps the newest ones", async () => {
    const store = new InMemoryAuthorizationGraphStore();
    await store.saveSnapshot({
      graphId: "delegation-2",
      snapshotId: "delegation-2:001",
      createdAt: "2026-04-24T00:00:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "delegation-2",
      snapshotId: "delegation-2:002",
      createdAt: "2026-04-24T00:01:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });

    const svc = new GraphExplorerService(store);
    const result = await svc.prune("delegation-2", 1);
    expect(result.deletedSnapshotIds).toEqual(["delegation-2:001"]);
    expect((await svc.list("delegation-2")).map((snapshot) => snapshot.snapshotId)).toEqual(["delegation-2:002"]);
  });

  it("lists graph ids and prunes all graphs in one sweep", async () => {
    const store = new InMemoryAuthorizationGraphStore();
    await store.saveSnapshot({
      graphId: "delegation-3",
      snapshotId: "delegation-3:001",
      createdAt: "2026-04-24T00:00:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "delegation-3",
      snapshotId: "delegation-3:002",
      createdAt: "2026-04-24T00:01:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "delegation-4",
      snapshotId: "delegation-4:001",
      createdAt: "2026-04-24T00:02:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "delegation-4",
      snapshotId: "delegation-4:002",
      createdAt: "2026-04-24T00:03:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });

    const svc = new GraphExplorerService(store);
    expect(await svc.graphIds()).toEqual(["delegation-3", "delegation-4"]);

    const result = await svc.pruneAll(1);
    expect(result.graphCount).toBe(2);
    expect(result.beforeCount).toBe(4);
    expect(result.afterCount).toBe(2);
    expect(result.deletedSnapshotIds).toEqual([
      "delegation-3:001",
      "delegation-4:001",
    ]);
  });
});
