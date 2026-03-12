import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordInsert } from "@qa-sdk/core";
import { InMemoryRecordStore } from "./record.adapter.js";

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

describe("InMemoryRecordStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores records and queries them by trace, session, and event key in timestamp order", async () => {
    const store = new InMemoryRecordStore();
    const lateRecord = buildRecord({
      logId: "log_late",
      timestamp: new Date("2026-03-12T00:00:03.000Z"),
      eventKey: "checkout_completed",
    });
    const earlyRecord = buildRecord({
      logId: "log_early",
      timestamp: new Date("2026-03-12T00:00:01.000Z"),
      eventKey: "user_signed_in",
    });
    const otherTraceRecord = buildRecord({
      logId: "log_other",
      traceId: "trace_2",
      qaSessionId: "session_2",
      timestamp: new Date("2026-03-12T00:00:02.000Z"),
    });

    await store.insertBatch([lateRecord, earlyRecord, otherTraceRecord]);

    await expect(store.findByTraceId("trace_1")).resolves.toEqual([
      {
        ...earlyRecord,
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
      },
      {
        ...lateRecord,
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
      },
    ]);

    await expect(store.findBySessionId("session_1")).resolves.toEqual([
      {
        ...earlyRecord,
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
      },
      {
        ...lateRecord,
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
      },
    ]);

    await expect(
      store.findByTraceAndEventKey("trace_1", "user_signed_in"),
    ).resolves.toEqual([
      {
        ...earlyRecord,
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
      },
    ]);
  });

  it("rejects duplicate log IDs before mutating the store", async () => {
    const store = new InMemoryRecordStore();

    await store.insertBatch([buildRecord({ logId: "log_existing" })]);

    await expect(
      store.insertBatch([
        buildRecord({ logId: "log_existing" }),
        buildRecord({ logId: "log_new", traceId: "trace_2" }),
      ]),
    ).rejects.toThrow("Record already exists");

    await expect(store.findByTraceId("trace_2")).resolves.toEqual([]);
  });

  it("paginates trace and session queries with timestamp and log ID cursors", async () => {
    const store = new InMemoryRecordStore();
    const sameTimestampA = buildRecord({
      logId: "log_a",
      timestamp: new Date("2026-03-12T00:00:01.000Z"),
    });
    const sameTimestampB = buildRecord({
      logId: "log_b",
      timestamp: new Date("2026-03-12T00:00:01.000Z"),
      eventKey: "checkout_started",
    });
    const laterTraceRecord = buildRecord({
      logId: "log_c",
      timestamp: new Date("2026-03-12T00:00:02.000Z"),
      eventKey: "checkout_completed",
    });
    const otherSessionRecord = buildRecord({
      logId: "log_d",
      traceId: "trace_2",
      qaSessionId: "session_2",
      timestamp: new Date("2026-03-12T00:00:03.000Z"),
    });

    await store.insertBatch([
      laterTraceRecord,
      sameTimestampB,
      otherSessionRecord,
      sameTimestampA,
    ]);

    const tracePageOne = await store.findByTraceIdPaginated("trace_1", {
      limit: 2,
    });

    expect(tracePageOne.items.map((record) => record.logId)).toEqual([
      "log_a",
      "log_b",
    ]);
    expect(tracePageOne.hasMore).toBe(true);
    expect(tracePageOne.nextCursor).toEqual({
      timestamp: new Date("2026-03-12T00:00:01.000Z"),
      logId: "log_b",
    });

    const tracePageTwo = await store.findByTraceIdPaginated("trace_1", {
      limit: 2,
      cursor: tracePageOne.nextCursor ?? undefined,
    });

    expect(tracePageTwo.items.map((record) => record.logId)).toEqual(["log_c"]);
    expect(tracePageTwo.hasMore).toBe(false);
    expect(tracePageTwo.nextCursor).toBeNull();

    const sessionPage = await store.findBySessionIdPaginated("session_1", {
      limit: 1,
      cursor: {
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
        logId: "log_a",
      },
    });

    expect(sessionPage.items.map((record) => record.logId)).toEqual(["log_b"]);
    expect(sessionPage.hasMore).toBe(true);
    expect(sessionPage.nextCursor).toEqual({
      timestamp: new Date("2026-03-12T00:00:01.000Z"),
      logId: "log_b",
    });
  });
});
