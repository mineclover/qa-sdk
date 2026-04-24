// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import { afterEach, describe, expect, it } from "vitest";
import {
  createInMemorySqliteAuthorizationGraphFixture,
} from "./memory-sqlite-fixture.js";
import { pruneAuthorizationGraphSnapshots } from "./create-store.js";

describe("createSimAuthorizationGraphStore — sqlite", () => {
  let fixture: Awaited<ReturnType<typeof createInMemorySqliteAuthorizationGraphFixture>> | null = null;

  afterEach(() => {
    fixture?.close();
    fixture = null;
  });

  it("save/get/list/delete round-trip", async () => {
    fixture = await createInMemorySqliteAuthorizationGraphFixture();

    const first = await fixture.store.saveSnapshot({
      graphId: "delegation-1",
      snapshotId: "delegation-1:001",
      createdAt: "2026-04-24T00:00:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
      tags: ["delegation"],
      labels: { env: "test" },
      metadata: { actor: "alice" },
      audit: true,
      auditOptions: {
        requireRoutePolicy: false,
        requireRouteEnforcement: false,
        requireRouteUpstream: false,
        requireApplicationResourcePolicy: false,
        requireApplicationResourceEnforcement: false,
        requireDecisionPolicyAction: false,
        requireDecisionPolicyResource: false,
      },
    });
    const second = await fixture.store.saveSnapshot({
      graphId: "delegation-1",
      snapshotId: "delegation-1:002",
      createdAt: "2026-04-24T00:01:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });

    expect((await fixture.store.getSnapshot(first.snapshotId))?.snapshotId).toBe(first.snapshotId);
    expect((await fixture.store.listSnapshots({ graphId: "delegation-1" })).map((item) => item.snapshotId)).toEqual([
      first.snapshotId,
      second.snapshotId,
    ]);
    expect((await fixture.store.listSnapshots({ tag: "delegation" })).length).toBe(1);
    expect(first.auditReport?.ok).toBe(true);
    expect(await fixture.store.deleteSnapshot(first.snapshotId)).toBe(true);
    expect(await fixture.store.getSnapshot(first.snapshotId)).toBeNull();
  });

  it("prunes old snapshots while keeping the latest N", async () => {
    fixture = await createInMemorySqliteAuthorizationGraphFixture();

    await fixture.store.saveSnapshot({
      graphId: "delegation-2",
      snapshotId: "delegation-2:001",
      createdAt: "2026-04-24T00:00:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await fixture.store.saveSnapshot({
      graphId: "delegation-2",
      snapshotId: "delegation-2:002",
      createdAt: "2026-04-24T00:01:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });
    await fixture.store.saveSnapshot({
      graphId: "delegation-2",
      snapshotId: "delegation-2:003",
      createdAt: "2026-04-24T00:02:00.000Z",
      graph: { realms: [], nodes: [], relations: [] },
    });

    const result = await pruneAuthorizationGraphSnapshots(fixture.store, {
      graphId: "delegation-2",
      keepLatest: 1,
    });

    expect(result.deletedSnapshotIds).toEqual([
      "delegation-2:001",
      "delegation-2:002",
    ]);
    expect(result.keptSnapshotIds).toEqual(["delegation-2:003"]);
    expect((await fixture.store.listSnapshots({ graphId: "delegation-2" })).map((snapshot) => snapshot.snapshotId)).toEqual([
      "delegation-2:003",
    ]);
  });
});
