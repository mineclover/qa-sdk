// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { InMemoryAuthorizationGraphStore } from "authorization-ontology";
import { GraphStoreQueryAdapter } from "./graph-store-query.adapter.js";

describe("GraphStoreQueryAdapter", () => {
  it("latest — graph 의 마지막 snapshot 반환", async () => {
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
    const adapter = new GraphStoreQueryAdapter(store);
    expect((await adapter.latest("delegation-1"))?.snapshotId).toBe("delegation-1:002");
  });

  it("list/diff — diff 컴퓨팅", async () => {
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
        nodes: [
          {
            nodeId: "n-1",
            kind: "principal",
            coord: {
              realm: "r",
              space: "principal",
              anchor: "a",
              taxonomies: {},
              canonicalKey: "n-1",
            },
            metadata: {},
          },
        ],
        relations: [],
      },
    });
    const adapter = new GraphStoreQueryAdapter(store);
    const snapshots = await adapter.list("delegation-1");
    expect(snapshots).toHaveLength(2);
    const diff = await adapter.diff("delegation-1:001", "delegation-1:002");
    expect(diff?.summary.addedNodeCount).toBe(1);
  });

  it("prune/pruneAll — retention sweep", async () => {
    const store = new InMemoryAuthorizationGraphStore();
    await store.saveSnapshot({
      graphId: "g1",
      snapshotId: "g1:001",
      createdAt: "2026-04-24T00:00:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "g1",
      snapshotId: "g1:002",
      createdAt: "2026-04-24T00:01:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: "g2",
      snapshotId: "g2:001",
      createdAt: "2026-04-24T00:02:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    const adapter = new GraphStoreQueryAdapter(store);
    expect(await adapter.graphIds()).toEqual(["g1", "g2"]);
    const result = await adapter.pruneAll(1);
    expect(result.graphCount).toBe(2);
    expect(result.deletedSnapshotIds).toEqual(["g1:001"]);
  });
});
