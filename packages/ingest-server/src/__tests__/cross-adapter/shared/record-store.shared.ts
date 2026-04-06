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

  it("findByTraceIdPaginated — cursor 기반 페이지네이션", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1", timestamp: new Date("2026-01-01T00:00:00Z") }),
      makeRecord({ logId: "r2", traceId: "t1", timestamp: new Date("2026-01-01T00:00:01Z") }),
      makeRecord({ logId: "r3", traceId: "t1", timestamp: new Date("2026-01-01T00:00:02Z") }),
    ]);
    const page1 = await store.findByTraceIdPaginated("t1", { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await store.findByTraceIdPaginated("t1", { cursor: page1.nextCursor!, limit: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });

  it("findByTimeRange — 시간 범위 필터", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1", timestamp: new Date("2026-01-01T00:00:00Z") }),
      makeRecord({ logId: "r2", traceId: "t1", timestamp: new Date("2026-01-02T00:00:00Z") }),
      makeRecord({ logId: "r3", traceId: "t1", timestamp: new Date("2026-01-03T00:00:00Z") }),
    ]);
    const results = await store.findByTimeRange({
      from: new Date("2026-01-01T12:00:00Z"),
      to: new Date("2026-01-02T12:00:00Z"),
    });
    expect(results).toHaveLength(1);
    expect(results[0].logId).toBe("r2");
  });

  it("findByTraceId 미존재 → 빈 배열", async () => {
    const results = await store.findByTraceId("nonexistent");
    expect(results).toEqual([]);
  });

  it("payload null 라운드트립", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", traceId: "t1", payload: null }),
    ]);
    const records = await store.findByTraceId("t1");
    // D1은 undefined, PG는 null — 둘 다 falsy
    expect(records[0].payload ?? null).toBeNull();
  });
}
