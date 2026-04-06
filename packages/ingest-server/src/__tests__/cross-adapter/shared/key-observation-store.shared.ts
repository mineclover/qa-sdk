import type { KeyObservationStore } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

export function keyObservationStoreTests(
  factory: () => Promise<{ store: KeyObservationStore; cleanup: () => Promise<void> }>,
) {
  let store: KeyObservationStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("observe + findByPrefix 라운드트립", async () => {
    await store.observe({
      packedKey: "svc:v1:42",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-06T10:00:00Z",
    });
    const results = await store.findByPrefix("svc");
    expect(results).toHaveLength(1);
    expect(results[0].packedKey).toBe("svc:v1:42");
    expect(results[0].count).toBe(1);
  });

  it("반복 observe 시 count 누적", async () => {
    const entry = { packedKey: "svc:v1:42", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" };
    await store.observe(entry);
    await store.observe({ ...entry, timestamp: "2026-04-06T11:00:00Z" });
    await store.observe({ ...entry, timestamp: "2026-04-06T12:00:00Z" });
    const results = await store.findByPrefix("svc");
    expect(results[0].count).toBe(3);
  });

  it("summary 전체 통계", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:01:00Z" },
      { packedKey: "pv:v2:1", prefixId: "pv", registered: false, timestamp: "2026-04-06T10:02:00Z" },
    ]);
    const s = await store.summary();
    expect(s.totalKeys).toBe(2);
    expect(s.totalCount).toBe(3);
  });

  it("findUnregistered — drift 감지", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "unk:v1:1", prefixId: "unk", registered: false, timestamp: "2026-04-06T10:01:00Z" },
    ]);
    const unregistered = await store.findUnregistered();
    expect(unregistered).toHaveLength(1);
    expect(unregistered[0].registered).toBe(false);
  });

  it("findByPrefix orderBy=last_seen", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:2", prefixId: "svc", registered: true, timestamp: "2026-04-06T12:00:00Z" },
    ]);
    const results = await store.findByPrefix("svc", { orderBy: "last_seen" });
    expect(results).toHaveLength(2);
    // last_seen DESC — 더 최근 관측이 먼저
    expect(results[0].packedKey).toBe("svc:v1:2");
  });

  it("prefixSummary — prefix 레벨 집계", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:2", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:01:00Z" },
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:02:00Z" },
    ]);
    const prefixes = await store.prefixSummary("svc");
    expect(prefixes).toHaveLength(1);
    expect(prefixes[0].totalCount).toBe(3);
  });
}
