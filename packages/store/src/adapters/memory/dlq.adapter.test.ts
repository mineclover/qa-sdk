// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DlqInsert } from "@qa-sdk/core";
import { InMemoryDlqStore } from "./dlq.adapter.js";

function buildDlqItem(overrides: Partial<DlqInsert> = {}): DlqInsert {
  return {
    id: "dlq_1",
    traceId: "trace_1",
    phase: "reconstruction",
    errorMessage: "reconstruction failed",
    ...overrides,
  };
}

describe("InMemoryDlqStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores pending items and tracks attempts and resolution state", async () => {
    const store = new InMemoryDlqStore();

    await store.insert(buildDlqItem());

    await expect(store.findPending()).resolves.toEqual([
      {
        id: "dlq_1",
        traceId: "trace_1",
        phase: "reconstruction",
        errorMessage: "reconstruction failed",
        attemptCount: 0,
        lastAttemptedAt: null,
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
        resolvedAt: null,
      },
    ]);

    vi.setSystemTime(new Date("2026-03-12T01:05:00.000Z"));
    await store.markAttempted("dlq_1");

    await expect(store.findPending()).resolves.toEqual([
      {
        id: "dlq_1",
        traceId: "trace_1",
        phase: "reconstruction",
        errorMessage: "reconstruction failed",
        attemptCount: 1,
        lastAttemptedAt: new Date("2026-03-12T01:05:00.000Z"),
        createdAt: new Date("2026-03-12T01:00:00.000Z"),
        resolvedAt: null,
      },
    ]);

    vi.setSystemTime(new Date("2026-03-12T01:10:00.000Z"));
    await store.markResolved("dlq_1");

    await expect(store.findPending()).resolves.toEqual([]);
  });

  it("rejects duplicate ids", async () => {
    const store = new InMemoryDlqStore();

    await store.insert(buildDlqItem());

    await expect(store.insert(buildDlqItem())).rejects.toThrow(
      "DLQ item already exists",
    );
  });
});
