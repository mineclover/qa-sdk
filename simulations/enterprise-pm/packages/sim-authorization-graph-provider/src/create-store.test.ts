// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import { afterEach, describe, expect, it } from "vitest";
import { createInMemorySqliteAuthorizationGraphFixture } from "./memory-sqlite-fixture.js";

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
});
