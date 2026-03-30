import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAddressRangeCache } from "./memory-address-range-cache.js";
import { SqlAddressRangeCache } from "./sql-address-range-cache.js";
import { NodeSqliteDriver } from "./node-sqlite-driver.js";
import type { RangeCacheRecord } from "../address-range-cache.js";

// ── 공통 테스트 스위트 ────────────────────────────────────────────────────

function rangeCacheSuite(
  name: string,
  factory: () => { cache: InMemoryAddressRangeCache | SqlAddressRangeCache },
) {
  describe(name, () => {
    let cache: InMemoryAddressRangeCache | SqlAddressRangeCache;

    beforeEach(() => {
      ({ cache } = factory());
    });

    const record: RangeCacheRecord = {
      prefix: "perm",
      versionId: "v1",
      label: "role=admin",
      ranges: [[0, 63], [256, 319]],
      constraints: ["1", null, null, null],
      computedAt: "2026-03-16T00:00:00Z",
    };

    it("save → get 왕복", async () => {
      await cache.save(record);
      const got = await cache.get("perm", "v1", "role=admin");
      expect(got).not.toBeNull();
      expect(got!.ranges).toEqual([[0, 63], [256, 319]]);
      expect(got!.constraints).toEqual(["1", null, null, null]);
      expect(got!.computedAt).toBe("2026-03-16T00:00:00Z");
    });

    it("get — 미존재 → null", async () => {
      const got = await cache.get("perm", "v1", "nonexistent");
      expect(got).toBeNull();
    });

    it("save — 덮어쓰기 (upsert)", async () => {
      await cache.save(record);
      const updated: RangeCacheRecord = {
        ...record,
        ranges: [[0, 127]],
        computedAt: "2026-03-17T00:00:00Z",
      };
      await cache.save(updated);
      const got = await cache.get("perm", "v1", "role=admin");
      expect(got!.ranges).toEqual([[0, 127]]);
      expect(got!.computedAt).toBe("2026-03-17T00:00:00Z");
    });

    it("constraints 없이 저장 가능", async () => {
      const noConstraints: RangeCacheRecord = {
        prefix: "perm",
        versionId: "v1",
        label: "custom",
        ranges: [[10, 20]],
        computedAt: "2026-03-16T00:00:00Z",
      };
      await cache.save(noConstraints);
      const got = await cache.get("perm", "v1", "custom");
      expect(got!.constraints).toBeUndefined();
    });

    it("list — 동일 (prefix, versionId)의 모든 캐시 반환", async () => {
      await cache.save(record);
      await cache.save({
        ...record,
        label: "action=write",
        ranges: [[64, 127]],
      });
      await cache.save({
        prefix: "perm",
        versionId: "v2",
        label: "role=admin",
        ranges: [[0, 255]],
        computedAt: "2026-03-16T00:00:00Z",
      });

      const v1List = await cache.list("perm", "v1");
      expect(v1List).toHaveLength(2);
      expect(v1List.map((r) => r.label).toSorted()).toEqual(["action=write", "role=admin"]);

      const v2List = await cache.list("perm", "v2");
      expect(v2List).toHaveLength(1);
    });

    it("delete — 단일 항목 삭제", async () => {
      await cache.save(record);
      await cache.delete("perm", "v1", "role=admin");
      const got = await cache.get("perm", "v1", "role=admin");
      expect(got).toBeNull();
    });

    it("deleteAll — 해당 (prefix, versionId)의 모든 캐시 삭제", async () => {
      await cache.save(record);
      await cache.save({ ...record, label: "action=write", ranges: [[64, 127]] });
      await cache.save({
        prefix: "perm",
        versionId: "v2",
        label: "role=admin",
        ranges: [[0, 255]],
        computedAt: "2026-03-16T00:00:00Z",
      });

      await cache.deleteAll("perm", "v1");

      expect(await cache.list("perm", "v1")).toHaveLength(0);
      // v2는 영향 없음
      expect(await cache.list("perm", "v2")).toHaveLength(1);
    });
  });
}

// ── InMemory ──────────────────────────────────────────────

rangeCacheSuite("InMemoryAddressRangeCache", () => ({
  cache: new InMemoryAddressRangeCache(),
}));

// ── SQL ───────────────────────────────────────────────────

rangeCacheSuite("SqlAddressRangeCache", () => {
  const driver = new NodeSqliteDriver();
  return { cache: new SqlAddressRangeCache(driver) };
});
