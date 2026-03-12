import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type {
  DlqInsert,
  RecordInsert,
  RuntimeGraph,
  VerdictInsert,
  VerdictReport,
} from "@qa-sdk/core";
import {
  DrizzleDlqStore,
  DrizzleGraphStore,
  DrizzleRecordStore,
  DrizzleSessionStore,
  DrizzleTraceStore,
  DrizzleTransmissionStore,
  DrizzleVerdictStore,
  withTransaction,
} from "../../index.js";
import {
  deadLetterQueue,
  qaSessions,
  runtimeGraphs,
  traces,
  transmissions,
  verdictReports,
} from "../../db/schema.js";
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

function buildReport(overrides: Partial<VerdictReport> = {}): VerdictReport {
  return {
    scenario_id: "scenario_signup",
    trace_id: "trace_1",
    qa_session_id: "session_1",
    overall_verdict: "pass",
    step_matches: [
      {
        step_id: "step_1",
        matched_node_id: "node_1",
        verdict: "pass",
        constraint_results: [],
      },
    ],
    missing_steps: [],
    unexpected_nodes: [],
    latency_violations: [],
    summary: "Scenario matched successfully.",
    computed_at: "2026-03-12T01:00:00.000Z",
    ...overrides,
  };
}

function buildVerdict(overrides: Partial<VerdictInsert> = {}): VerdictInsert {
  return {
    id: "verdict_1",
    scenarioId: "scenario_signup",
    traceId: "trace_1",
    qaSessionId: "session_1",
    overallVerdict: "pass",
    report: buildReport(),
    ...overrides,
  };
}

function buildDlqItem(overrides: Partial<DlqInsert> = {}): DlqInsert {
  return {
    id: "dlq_1",
    traceId: "trace_1",
    phase: "reconstruction",
    errorMessage: "reconstruction failed",
    ...overrides,
  };
}

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

async function seedTrace(
  db: Db,
  overrides: Partial<typeof traces.$inferInsert> = {},
) {
  await db.insert(traces).values({
    traceId: "trace_1",
    sessionId: null,
    serviceName: "mobile-app",
    recordCount: 1,
    firstTimestamp: new Date("2026-03-12T00:00:01.000Z"),
    lastTimestamp: new Date("2026-03-12T00:00:01.000Z"),
    ...overrides,
  });
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase("Drizzle adapters on PostgreSQL", () => {
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

  describe("DrizzleRecordStore", () => {
    it("inserts batches and queries records by trace, cursor, and event key", async () => {
      await seedTrace(db, { traceId: "trace_1" });
      await seedTrace(db, { traceId: "trace_2" });

      const store = new DrizzleRecordStore(db);
      const firstRecord = buildRecord({
        logId: "log_a",
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
      });
      const secondRecord = buildRecord({
        logId: "log_b",
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
        eventKey: "checkout_started",
      });
      const thirdRecord = buildRecord({
        logId: "log_c",
        timestamp: new Date("2026-03-12T00:00:02.000Z"),
        eventKey: "checkout_completed",
      });
      const otherTraceRecord = buildRecord({
        logId: "log_other",
        traceId: "trace_2",
        qaSessionId: "session_2",
        timestamp: new Date("2026-03-12T00:00:03.000Z"),
      });

      await store.insertBatch([
        thirdRecord,
        secondRecord,
        otherTraceRecord,
        firstRecord,
      ]);

      await expect(store.findByTraceId("trace_1")).resolves.toEqual([
        {
          ...firstRecord,
          createdAt: expect.any(Date),
        },
        {
          ...secondRecord,
          createdAt: expect.any(Date),
        },
        {
          ...thirdRecord,
          createdAt: expect.any(Date),
        },
      ]);

      const firstPage = await store.findByTraceIdPaginated("trace_1", {
        limit: 2,
      });

      expect(firstPage.items.map((record) => record.logId)).toEqual([
        "log_a",
        "log_b",
      ]);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextCursor).toEqual({
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
        logId: "log_b",
      });

      const secondPage = await store.findByTraceIdPaginated("trace_1", {
        limit: 2,
        cursor: firstPage.nextCursor ?? undefined,
      });

      expect(secondPage.items.map((record) => record.logId)).toEqual(["log_c"]);
      expect(secondPage.hasMore).toBe(false);
      expect(secondPage.nextCursor).toBeNull();

      await expect(
        store.findByTraceAndEventKey("trace_1", "checkout_completed"),
      ).resolves.toEqual([
        {
          ...thirdRecord,
          createdAt: expect.any(Date),
        },
      ]);
    });

    it("ignores duplicate log IDs when inserting a later batch", async () => {
      await seedTrace(db, { traceId: "trace_1" });

      const store = new DrizzleRecordStore(db);
      const original = buildRecord({
        logId: "log_existing",
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
      });
      const newRecord = buildRecord({
        logId: "log_new",
        timestamp: new Date("2026-03-12T00:00:02.000Z"),
      });

      await store.insertBatch([original]);

      await expect(
        store.insertBatch([
          original,
          newRecord,
        ]),
      ).resolves.toBeUndefined();

      await expect(store.findByTraceId("trace_1")).resolves.toEqual([
        {
          ...original,
          createdAt: expect.any(Date),
        },
        {
          ...newRecord,
          createdAt: expect.any(Date),
        },
      ]);
    });
  });

  describe("DrizzleTraceStore", () => {
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

  describe("withTransaction", () => {
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

  describe("DrizzleSessionStore", () => {
    it("upserts sessions idempotently, finds them by id, and closes them", async () => {
      const store = new DrizzleSessionStore(db);

      await store.upsert({
        sessionId: "session_1",
        scenarioId: "scenario_signup",
        labels: { region: "kr" },
      });

      const created = await store.findById("session_1");
      expect(created).toEqual({
        sessionId: "session_1",
        scenarioId: "scenario_signup",
        labels: { region: "kr" },
        startedAt: expect.any(Date),
        closedAt: null,
      });

      await store.upsert({
        sessionId: "session_1",
        scenarioId: "scenario_checkout",
        labels: { region: "us" },
      });

      const duplicate = await store.findById("session_1");
      expect(duplicate).toEqual(created);
      expect(await db.select().from(qaSessions)).toHaveLength(1);

      await store.close("session_1");

      await expect(store.findById("session_1")).resolves.toEqual({
        sessionId: "session_1",
        scenarioId: "scenario_signup",
        labels: { region: "kr" },
        startedAt: created!.startedAt,
        closedAt: expect.any(Date),
      });
    });
  });

  describe("DrizzleTransmissionStore", () => {
    it("persists transmissions in PostgreSQL", async () => {
      const store = new DrizzleTransmissionStore(db);

      await store.insert({
        transmissionId: "tx_1",
        sentAt: new Date("2026-03-12T00:00:00.000Z"),
        ownerType: "workspace",
        ownerId: "workspace_1",
        serviceName: "mobile-app",
        sdkName: "qa-sdk-js",
        sdkVersion: "0.1.0",
        platform: "ios",
        env: "staging",
        recordCount: 3,
      });

      await expect(db.select().from(transmissions)).resolves.toEqual([
        {
          transmissionId: "tx_1",
          sentAt: new Date("2026-03-12T00:00:00.000Z"),
          ownerType: "workspace",
          ownerId: "workspace_1",
          serviceName: "mobile-app",
          sdkName: "qa-sdk-js",
          sdkVersion: "0.1.0",
          platform: "ios",
          env: "staging",
          recordCount: 3,
          receivedAt: expect.any(Date),
        },
      ]);
    });
  });

  describe("DrizzleGraphStore", () => {
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

  describe("DrizzleVerdictStore", () => {
    it("inserts verdicts and queries them by scenario/trace and session", async () => {
      await seedTrace(db, { traceId: "trace_1" });
      await seedTrace(db, { traceId: "trace_2" });

      const store = new DrizzleVerdictStore(db);
      const verdict = buildVerdict();
      const otherVerdict = buildVerdict({
        id: "verdict_2",
        scenarioId: "scenario_checkout",
        traceId: "trace_2",
        qaSessionId: "session_1",
        report: buildReport({
          scenario_id: "scenario_checkout",
          trace_id: "trace_2",
        }),
      });

      await store.insert(verdict);
      await store.insert(otherVerdict);

      await expect(
        store.findByScenarioAndTrace("scenario_signup", "trace_1"),
      ).resolves.toEqual({
        ...verdict,
        computedAt: expect.any(Date),
      });

      const sessionVerdicts = await store.findBySessionId("session_1");
      expect(sessionVerdicts).toHaveLength(2);
      expect(sessionVerdicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "verdict_1",
            scenarioId: "scenario_signup",
            traceId: "trace_1",
          }),
          expect.objectContaining({
            id: "verdict_2",
            scenarioId: "scenario_checkout",
            traceId: "trace_2",
          }),
        ]),
      );
    });

    it("enforces the unique scenario and trace pair constraint", async () => {
      await seedTrace(db, { traceId: "trace_1" });

      const store = new DrizzleVerdictStore(db);
      await store.insert(buildVerdict());

      await expect(
        store.insert(
          buildVerdict({
            id: "verdict_2",
          }),
        ),
      ).rejects.toMatchObject({ code: "23505" });
      expect(await db.select().from(verdictReports)).toHaveLength(1);
    });
  });

  describe("DrizzleDlqStore", () => {
    it("stores pending items and tracks attempts and resolution", async () => {
      await seedTrace(db, { traceId: "trace_1" });

      const store = new DrizzleDlqStore(db);
      await store.insert(buildDlqItem());

      await expect(store.findPending()).resolves.toEqual([
        {
          id: "dlq_1",
          traceId: "trace_1",
          phase: "reconstruction",
          errorMessage: "reconstruction failed",
          attemptCount: 0,
          lastAttemptedAt: null,
          createdAt: expect.any(Date),
          resolvedAt: null,
        },
      ]);

      await store.markAttempted("dlq_1");

      await expect(store.findPending()).resolves.toEqual([
        {
          id: "dlq_1",
          traceId: "trace_1",
          phase: "reconstruction",
          errorMessage: "reconstruction failed",
          attemptCount: 1,
          lastAttemptedAt: expect.any(Date),
          createdAt: expect.any(Date),
          resolvedAt: null,
        },
      ]);

      await store.markResolved("dlq_1");

      await expect(store.findPending()).resolves.toEqual([]);
      await expect(
        db
          .select()
          .from(deadLetterQueue)
          .where(eq(deadLetterQueue.id, "dlq_1")),
      ).resolves.toEqual([
        expect.objectContaining({
          id: "dlq_1",
          attemptCount: 1,
          resolvedAt: expect.any(Date),
        }),
      ]);
    });
  });
});
