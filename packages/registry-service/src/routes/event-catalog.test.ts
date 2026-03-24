/**
 * event-catalog 라우트 단위 테스트.
 *
 * @qa-sdk/event-catalog 패키지를 실제 로드하여 API 응답 검증.
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createEventCatalogRoutes } from "./event-catalog.js";

function buildApp() {
  const app = new Hono();
  app.route("/", createEventCatalogRoutes());
  return app;
}

describe("event-catalog routes", () => {
  const app = buildApp();

  describe("GET /api/event-catalog", () => {
    it("전체 요약 반환", async () => {
      const res = await app.request("/api/event-catalog");
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.totalEvents).toBeGreaterThan(0);
      expect(d.categories).toBeTruthy();
      expect(Object.keys(d.categories).length).toBeGreaterThanOrEqual(5);
      expect(d.v1MinimalCount).toBeGreaterThan(0);
      expect(d.prefixMappings).toBeGreaterThan(0);
    });
  });

  describe("GET /api/event-catalog/events", () => {
    it("전체 이벤트 목록", async () => {
      const res = await app.request("/api/event-catalog/events");
      const items = await res.json() as any[];
      expect(items.length).toBeGreaterThan(0);
      // 각 이벤트에 필수 필드
      for (const e of items.slice(0, 3)) {
        expect(e.event_key).toBeTruthy();
        expect(e.category).toBeTruthy();
        expect(Array.isArray(e.channel)).toBe(true);
      }
    });

    it("category 필터", async () => {
      const res = await app.request("/api/event-catalog/events?category=navigation");
      const items = await res.json() as any[];
      expect(items.length).toBeGreaterThan(0);
      for (const e of items) {
        expect(e.category).toBe("navigation");
      }
    });
  });

  describe("GET /api/event-catalog/events/:key", () => {
    it("이벤트 상세 + payload guide", async () => {
      const res = await app.request("/api/event-catalog/events/click");
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.event).toBeTruthy();
      expect(d.event.event_key).toBe("click");
      expect(d.event.category).toBe("interaction");
    });

    it("없는 이벤트 → 404", async () => {
      const res = await app.request("/api/event-catalog/events/nonexistent_event_xyz");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/event-catalog/categories", () => {
    it("카테고리별 이벤트 목록", async () => {
      const res = await app.request("/api/event-catalog/categories");
      const items = await res.json() as any[];
      expect(items.length).toBeGreaterThanOrEqual(5);
      for (const cat of items) {
        expect(cat.category).toBeTruthy();
        expect(cat.count).toBeGreaterThan(0);
        expect(Array.isArray(cat.events)).toBe(true);
      }
    });
  });

  describe("GET /api/event-catalog/mappings", () => {
    it("prefix 매핑 목록", async () => {
      const res = await app.request("/api/event-catalog/mappings");
      const items = await res.json() as any[];
      expect(items.length).toBeGreaterThan(0);
      for (const m of items) {
        expect(m.event_key).toBeTruthy();
        expect(m.domain).toBeTruthy();
        expect(Array.isArray(m.prefixes)).toBe(true);
      }
    });
  });
});
