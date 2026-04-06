import type { TraceStore } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

export function traceStoreTests(
  factory: () => Promise<{ store: TraceStore; cleanup: () => Promise<void> }>,
) {
  let store: TraceStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("upsert + findById", async () => {
    await store.upsert({
      traceId: "t1",
      serviceName: "web",
      recordCount: 3,
      firstTimestamp: new Date("2026-01-01"),
      lastTimestamp: new Date("2026-01-01T00:00:02"),
    });
    const trace = await store.findById("t1");
    expect(trace).not.toBeNull();
    expect(trace!.recordCount).toBe(3);
    expect(trace!.serviceName).toBe("web");
  });

  it("upsert 중복 시 recordCount 누적", async () => {
    await store.upsert({ traceId: "t1", recordCount: 2, firstTimestamp: new Date("2026-01-01"), lastTimestamp: new Date("2026-01-01T00:00:01") });
    await store.upsert({ traceId: "t1", recordCount: 3, firstTimestamp: new Date("2026-01-01T00:00:02"), lastTimestamp: new Date("2026-01-01T00:00:04") });
    const trace = await store.findById("t1");
    expect(trace!.recordCount).toBe(5);
  });

  it("findRecent (optional)", async () => {
    // findRecent는 TraceStore의 optional 메서드
    if (!store.findRecent) return;

    await store.upsert({ traceId: "t1", recordCount: 1, firstTimestamp: new Date("2026-01-01"), lastTimestamp: new Date("2026-01-01") });
    await store.upsert({ traceId: "t2", recordCount: 1, firstTimestamp: new Date("2026-01-02"), lastTimestamp: new Date("2026-01-02") });
    const recent = await store.findRecent(10);
    expect(recent.length).toBe(2);
  });

  it("markReconstructed", async () => {
    await store.upsert({ traceId: "t1", recordCount: 1, firstTimestamp: new Date(), lastTimestamp: new Date() });
    await store.markReconstructed("t1");
    const trace = await store.findById("t1");
    expect(trace!.reconstructed).toBe(true);
  });

  it("findUnreconstructed — reconstructed=false만 반환", async () => {
    await store.upsert({ traceId: "t1", recordCount: 1, firstTimestamp: new Date(), lastTimestamp: new Date() });
    await store.upsert({ traceId: "t2", recordCount: 1, firstTimestamp: new Date(), lastTimestamp: new Date() });
    await store.markReconstructed("t1");
    const unreconstructed = await store.findUnreconstructed();
    expect(unreconstructed).toHaveLength(1);
    expect(unreconstructed[0].traceId).toBe("t2");
  });

  it("findById 미존재 → null", async () => {
    expect(await store.findById("nonexistent")).toBeNull();
  });
}
