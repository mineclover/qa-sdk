import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DrizzleTraceStore } from "../../index.js";
import { qaSessions, traces } from "../../db/schema.js";
import type { Db } from "../../db/client.js";
import {
  cleanupDb,
  closeTestDb,
  createTestDb,
  hasTestDatabaseUrl,
} from "./test-db.js";

async function seedSession(
  db: Db,
  overrides: Partial<typeof qaSessions.$inferInsert> = {},
) {
  await db.insert(qaSessions).values({
    sessionId: "session_1",
    scenarioId: "scenario_signup",
    labels: { region: "kr" },
    ...overrides,
  });
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase("DrizzleTraceStore", () => {
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

  it("accumulates record counts and widens the timestamp window across upserts", async () => {
    await seedSession(db, { sessionId: "session_1" });

    const store = new DrizzleTraceStore(db);
    await store.upsert({
      traceId: "trace_1",
      sessionId: "session_1",
      serviceName: "mobile-app",
      recordCount: 2,
      firstTimestamp: new Date("2026-03-12T00:00:02.000Z"),
      lastTimestamp: new Date("2026-03-12T00:00:04.000Z"),
    });

    const created = await store.findById("trace_1");
    expect(created).toEqual({
      traceId: "trace_1",
      sessionId: "session_1",
      serviceName: "mobile-app",
      actorId: null,
      userId: null,
      userAttributes: null,
      recordCount: 2,
      firstTimestamp: new Date("2026-03-12T00:00:02.000Z"),
      lastTimestamp: new Date("2026-03-12T00:00:04.000Z"),
      reconstructed: false,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });

    await store.upsert({
      traceId: "trace_1",
      sessionId: "session_2",
      serviceName: "changed-service",
      recordCount: 3,
      firstTimestamp: new Date("2026-03-12T00:00:01.000Z"),
      lastTimestamp: new Date("2026-03-12T00:00:05.000Z"),
    });

    const updated = await store.findById("trace_1");
    expect(updated).toEqual({
      traceId: "trace_1",
      sessionId: "session_1",
      serviceName: "mobile-app",
      actorId: null,
      userId: null,
      userAttributes: null,
      recordCount: 5,
      firstTimestamp: new Date("2026-03-12T00:00:01.000Z"),
      lastTimestamp: new Date("2026-03-12T00:00:05.000Z"),
      reconstructed: false,
      createdAt: created!.createdAt,
      updatedAt: expect.any(Date),
    });
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created!.updatedAt.getTime(),
    );
  });

  it("finds unreconstructed traces in created order and marks them reconstructed", async () => {
    const store = new DrizzleTraceStore(db);

    await store.upsert({
      traceId: "trace_1",
      recordCount: 1,
      firstTimestamp: new Date("2026-03-12T00:00:01.000Z"),
      lastTimestamp: new Date("2026-03-12T00:00:01.000Z"),
    });
    await store.upsert({
      traceId: "trace_2",
      recordCount: 1,
      firstTimestamp: new Date("2026-03-12T00:00:02.000Z"),
      lastTimestamp: new Date("2026-03-12T00:00:02.000Z"),
    });

    await db
      .update(traces)
      .set({
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
        updatedAt: new Date("2026-03-12T01:00:00.000Z"),
      })
      .where(eq(traces.traceId, "trace_1"));
    await db
      .update(traces)
      .set({
        createdAt: new Date("2026-03-12T02:00:00.000Z"),
        updatedAt: new Date("2026-03-12T02:00:00.000Z"),
      })
      .where(eq(traces.traceId, "trace_2"));

    const limited = await store.findUnreconstructed(1);
    expect(limited.map((trace) => trace.traceId)).toEqual(["trace_1"]);

    await store.markReconstructed("trace_1");

    await expect(store.findUnreconstructed()).resolves.toEqual([
      expect.objectContaining({
        traceId: "trace_2",
        reconstructed: false,
      }),
    ]);

    await expect(store.findById("trace_1")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_1",
        reconstructed: true,
        updatedAt: expect.any(Date),
      }),
    );
  });
});
