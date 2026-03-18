import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredRecord } from "@qa-sdk/core";
import {
  DEFAULT_DEBUG_STORE_TTL_MS,
  resolveDebugStoreTtlMs,
} from "./debug-store.js";
import { InMemoryDebugStore } from "./in-memory-debug-store.js";

function makeRecord(overrides: Partial<StoredRecord> = {}): StoredRecord {
  return {
    logId: "log_1",
    traceId: "trace_1",
    spanId: "span_1",
    timestamp: new Date("2026-03-18T00:00:00.000Z"),
    recordKind: "log",
    eventKey: "debug.test",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: { ok: true },
    createdAt: new Date("2026-03-18T00:00:00.000Z"),
    ...overrides,
  };
}

describe("InMemoryDebugStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("appends records and returns the most recent trace and session matches", async () => {
    const store = new InMemoryDebugStore({ ttlMs: 10_000 });

    await store.append(
      makeRecord({
        logId: "log_trace_1",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:01.000Z"),
        createdAt: new Date("2026-03-18T00:00:01.000Z"),
      }),
    );
    await store.append(
      makeRecord({
        logId: "log_trace_2",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:02.000Z"),
        createdAt: new Date("2026-03-18T00:00:02.000Z"),
      }),
    );
    await store.append(
      makeRecord({
        logId: "log_trace_3",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:03.000Z"),
        createdAt: new Date("2026-03-18T00:00:03.000Z"),
      }),
    );
    await store.append(
      makeRecord({
        logId: "log_other",
        traceId: "trace_other",
        qaSessionId: "session_other",
        timestamp: new Date("2026-03-18T00:00:04.000Z"),
        createdAt: new Date("2026-03-18T00:00:04.000Z"),
      }),
    );

    await expect(store.getRecentByTrace("trace_checkout", 2)).resolves.toEqual([
      makeRecord({
        logId: "log_trace_3",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:03.000Z"),
        createdAt: new Date("2026-03-18T00:00:03.000Z"),
      }),
      makeRecord({
        logId: "log_trace_2",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:02.000Z"),
        createdAt: new Date("2026-03-18T00:00:02.000Z"),
      }),
    ]);
    await expect(
      store.getRecentBySession("session_checkout", 3),
    ).resolves.toEqual([
      makeRecord({
        logId: "log_trace_3",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:03.000Z"),
        createdAt: new Date("2026-03-18T00:00:03.000Z"),
      }),
      makeRecord({
        logId: "log_trace_2",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:02.000Z"),
        createdAt: new Date("2026-03-18T00:00:02.000Z"),
      }),
      makeRecord({
        logId: "log_trace_1",
        traceId: "trace_checkout",
        qaSessionId: "session_checkout",
        timestamp: new Date("2026-03-18T00:00:01.000Z"),
        createdAt: new Date("2026-03-18T00:00:01.000Z"),
      }),
    ]);
  });

  it("expires entries using DEBUG_STORE_TTL_MS when no ttl override is provided", async () => {
    vi.stubEnv("DEBUG_STORE_TTL_MS", "50");
    const store = new InMemoryDebugStore();

    await store.append(
      makeRecord({
        logId: "log_ttl",
        traceId: "trace_ttl",
      }),
    );

    await expect(store.getRecentByTrace("trace_ttl", 10)).resolves.toHaveLength(1);

    await vi.advanceTimersByTimeAsync(49);
    await expect(store.getRecentByTrace("trace_ttl", 10)).resolves.toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(store.getRecentByTrace("trace_ttl", 10)).resolves.toEqual([]);
  });

  it("evicts the oldest entries first when maxEntries is exceeded", async () => {
    const store = new InMemoryDebugStore({
      maxEntries: 2,
      ttlMs: 10_000,
    });

    await store.append(
      makeRecord({
        logId: "log_oldest",
        traceId: "trace_fifo",
      }),
    );
    await store.append(
      makeRecord({
        logId: "log_middle",
        traceId: "trace_fifo",
      }),
    );
    await store.append(
      makeRecord({
        logId: "log_newest",
        traceId: "trace_fifo",
      }),
    );

    await expect(store.getRecentByTrace("trace_fifo", 10)).resolves.toEqual([
      makeRecord({
        logId: "log_middle",
        traceId: "trace_fifo",
      }),
      makeRecord({
        logId: "log_newest",
        traceId: "trace_fifo",
      }),
    ]);
  });

  it("returns an empty array when no records match", async () => {
    const store = new InMemoryDebugStore({ ttlMs: 10_000 });

    await expect(store.getRecentByTrace("missing_trace", 10)).resolves.toEqual([]);
    await expect(
      store.getRecentBySession("missing_session", 10),
    ).resolves.toEqual([]);
  });
});

describe("resolveDebugStoreTtlMs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to five minutes when DEBUG_STORE_TTL_MS is unset", () => {
    expect(resolveDebugStoreTtlMs({})).toBe(DEFAULT_DEBUG_STORE_TTL_MS);
  });
});
