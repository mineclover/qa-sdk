import { describe, it, expect } from "vitest";
import { InMemoryAggregator } from "./aggregator.adapter.js";

describe("InMemoryAggregator", () => {
  function createWithData() {
    const agg = new InMemoryAggregator({
      decode: (key) => {
        const parts = key.split(":");
        return parts.length === 3 ? { env: parts[0], region: parts[1], svc: parts[2] } : undefined;
      },
    });
    agg.ingest("prod:us:api", "2026-04-01T00:00:00Z");
    agg.ingest("prod:us:api", "2026-04-01T01:00:00Z");
    agg.ingest("prod:eu:api", "2026-04-01T02:00:00Z");
    agg.ingest("dev:us:web", "2026-04-01T03:00:00Z");
    agg.ingest("prod:us:api", "2026-04-02T00:00:00Z");
    return agg;
  }

  describe("groupByKey", () => {
    it("지정 키 기반 그룹핑 — count + lastSeen", async () => {
      const agg = createWithData();
      const result = await agg.groupByKey(["prod:us:api", "prod:eu:api"]);
      expect(result).toHaveLength(2);
      // count 내림차순
      expect(result[0].key).toBe("prod:us:api");
      expect(result[0].count).toBe(3);
      expect(result[0].lastSeen).toBe("2026-04-02T00:00:00Z");
      expect(result[1].key).toBe("prod:eu:api");
      expect(result[1].count).toBe(1);
    });

    it("limit 적용", async () => {
      const agg = createWithData();
      const result = await agg.groupByKey(
        ["prod:us:api", "prod:eu:api", "dev:us:web"],
        { limit: 2 },
      );
      expect(result).toHaveLength(2);
    });

    it("시간 범위 필터", async () => {
      const agg = createWithData();
      const result = await agg.groupByKey(
        ["prod:us:api"],
        { from: "2026-04-01T01:00:00Z", to: "2026-04-01T23:59:59Z" },
      );
      expect(result[0].count).toBe(1); // 01:00만 해당
    });

    it("매칭 키 없음 → 빈 배열", async () => {
      const agg = createWithData();
      const result = await agg.groupByKey(["nonexistent"]);
      expect(result).toHaveLength(0);
    });
  });

  describe("projectAxis", () => {
    it("단일 축 프로젝션", async () => {
      const agg = createWithData();
      const result = await agg.projectAxis(
        ["prod:us:api", "prod:eu:api", "dev:us:web"],
        ["env"],
      );
      // prod: 4건, dev: 1건
      expect(result).toHaveLength(2);
      expect(result[0].axisValues.env).toBe("prod");
      expect(result[0].count).toBe(4);
      expect(result[1].axisValues.env).toBe("dev");
      expect(result[1].count).toBe(1);
    });

    it("복수 축 프로젝션", async () => {
      const agg = createWithData();
      const result = await agg.projectAxis(
        ["prod:us:api", "prod:eu:api", "dev:us:web"],
        ["env", "region"],
      );
      // prod:us(3), prod:eu(1), dev:us(1)
      expect(result).toHaveLength(3);
      expect(result[0].axisValues).toEqual({ env: "prod", region: "us" });
      expect(result[0].count).toBe(3);
    });

    it("decode 없이 호출 → 에러", async () => {
      const agg = new InMemoryAggregator();
      agg.ingest("key1", "2026-04-01T00:00:00Z");
      await expect(agg.projectAxis(["key1"], ["env"])).rejects.toThrow("decode 함수가 필요합니다");
    });

    it("decode 실패(undefined) → 해당 항목 건너뜀", async () => {
      const agg = new InMemoryAggregator({
        decode: (key) => key === "valid" ? { env: "prod" } : undefined,
      });
      agg.ingest("valid", "2026-04-01T00:00:00Z");
      agg.ingest("invalid", "2026-04-01T00:00:00Z");
      const result = await agg.projectAxis(["valid", "invalid"], ["env"]);
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(1);
    });

    it("limit 적용", async () => {
      const agg = createWithData();
      const result = await agg.projectAxis(
        ["prod:us:api", "prod:eu:api", "dev:us:web"],
        ["env", "region"],
        { limit: 1 },
      );
      expect(result).toHaveLength(1);
    });
  });
});
