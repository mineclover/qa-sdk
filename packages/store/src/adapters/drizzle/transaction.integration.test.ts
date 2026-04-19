// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RecordInsert } from "@qa-sdk/core";
import {
  DrizzleRecordStore,
  DrizzleSessionStore,
  DrizzleTraceStore,
  withTransaction,
} from "../../index.js";
import type { Db } from "../../db/client.js";
import {
  cleanupDb,
  closeTestDb,
  createTestDb,
  hasTestDatabaseUrl,
} from "./test-db.js";

function buildRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: "log_1",
    traceId: "trace_1",
    spanId: "span_1",
    timestamp: new Date("2026-03-12T00:00:03.000Z"),
    recordKind: "log",
    eventKey: "user_signed_in",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: { ok: true },
    qaSessionId: "session_1",
    ...overrides,
  };
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase("withTransaction", () => {
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

  it("rolls back trace, session, and record writes when the transaction fails", async () => {
    await expect(
      withTransaction(db, async (tx) => {
        const sessionStore = new DrizzleSessionStore(tx);
        const traceStore = new DrizzleTraceStore(tx);
        const recordStore = new DrizzleRecordStore(tx);

        await sessionStore.upsert({ sessionId: "session_1" });
        await traceStore.upsert({
          traceId: "trace_1",
          sessionId: "session_1",
          serviceName: "mobile-app",
          recordCount: 1,
          firstTimestamp: new Date("2026-03-12T00:00:01.000Z"),
          lastTimestamp: new Date("2026-03-12T00:00:01.000Z"),
        });
        await recordStore.insertBatch([buildRecord()]);

        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(new DrizzleSessionStore(db).findById("session_1")).resolves.toBeNull();
    await expect(new DrizzleTraceStore(db).findById("trace_1")).resolves.toBeNull();
    await expect(new DrizzleRecordStore(db).findByTraceId("trace_1")).resolves.toEqual(
      [],
    );
  });
});
