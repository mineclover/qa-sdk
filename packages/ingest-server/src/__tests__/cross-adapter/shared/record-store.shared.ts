import type { RecordStore, RecordInsert } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

export function makeRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: "r1",
    traceId: "t1",
    spanId: "s1",
    timestamp: new Date("2026-01-01T00:00:00Z"),
    recordKind: "log",
    eventKey: "page.view",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: { page: "home" },
    ...overrides,
  };
}

export function recordStoreTests(
  factory: () => Promise<{ store: RecordStore; cleanup: () => Promise<void> }>,
) {
  let store: RecordStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("insertBatch + findByTraceId", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1" }),
      makeRecord({ logId: "r2", traceId: "t1", eventKey: "cart.add" }),
    ]);
    const records = await store.findByTraceId("t1");
    expect(records).toHaveLength(2);
  });

  it("중복 삽입 무시", async () => {
    const record = makeRecord({ logId: "dup", traceId: "t1" });
    await store.insertBatch([record]);
    await store.insertBatch([record]);
    const records = await store.findByTraceId("t1");
    expect(records).toHaveLength(1);
  });

  it("findBySessionId", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1", qaSessionId: "s1" }),
      makeRecord({ logId: "r2", traceId: "t2", qaSessionId: "s1" }),
      makeRecord({ logId: "r3", traceId: "t3", qaSessionId: "s2" }),
    ]);
    const records = await store.findBySessionId("s1");
    expect(records).toHaveLength(2);
  });

  it("findByTraceAndEventKey", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1", eventKey: "page.view" }),
      makeRecord({ logId: "r2", traceId: "t1", eventKey: "cart.add" }),
    ]);
    const records = await store.findByTraceAndEventKey("t1", "cart.add");
    expect(records).toHaveLength(1);
    expect(records[0].eventKey).toBe("cart.add");
  });

  it("addressContext JSON 라운드트립", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1", addressContext: { svc: "svc:v1:0" } }),
    ]);
    const records = await store.findByTraceId("t1");
    expect(records[0].addressContext).toEqual({ svc: "svc:v1:0" });
  });
}
