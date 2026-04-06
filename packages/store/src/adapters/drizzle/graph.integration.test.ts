import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { RuntimeGraph } from "@qa-sdk/core";
import { DrizzleGraphStore } from "../../index.js";
import { runtimeGraphs } from "../../db/schema.js";
import type { Db } from "../../db/client.js";
import {
  cleanupDb,
  closeTestDb,
  createTestDb,
  hasTestDatabaseUrl,
} from "./test-db.js";
import { seedTrace } from "./test-fixtures.js";

function buildGraph(edgeTo = "node_2"): RuntimeGraph {
  return {
    trace_id: "trace_1",
    nodes: [
      {
        id: "node_1",
        log_id: "log_1",
        timestamp: "2026-03-12T00:00:00.000Z",
        record_kind: "log",
        event_key: "user_signed_in",
        event_version: "001",
        payload: { ok: true },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
      {
        id: "node_2",
        log_id: "log_2",
        timestamp: "2026-03-12T00:00:01.000Z",
        record_kind: "log",
        event_key: "checkout_completed",
        event_version: "001",
        payload: { ok: true },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    edges: [{ source: "node_1", target: edgeTo, type: "temporal" }],
  };
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase("DrizzleGraphStore", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await cleanupDb();
  });

  afterEach(async () => {
    await cleanupDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("upserts graphs by overwriting the previous JSON payload", async () => {
    await seedTrace(db, { traceId: "trace_1" });

    const store = new DrizzleGraphStore(db);

    await store.upsert("trace_1", buildGraph());
    await expect(store.findByTraceId("trace_1")).resolves.toEqual(buildGraph());

    await store.upsert("trace_1", buildGraph("node_1"));

    await expect(store.findByTraceId("trace_1")).resolves.toEqual(
      buildGraph("node_1"),
    );
    await expect(store.findByTraceId("missing")).resolves.toBeNull();
    await expect(
      db
        .select()
        .from(runtimeGraphs)
        .where(eq(runtimeGraphs.traceId, "trace_1")),
    ).resolves.toEqual([
      expect.objectContaining({
        traceId: "trace_1",
        graph: buildGraph("node_1"),
        nodeCount: 2,
        edgeCount: 1,
        builtAt: expect.any(Date),
      }),
    ]);
  });
});
