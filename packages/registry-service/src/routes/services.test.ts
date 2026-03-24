/**
 * services 라우트 단위 테스트.
 *
 * ConfigStore 주입 → CRUD + gateway 라우팅 응답 검증.
 */

import { Hono } from "hono";
import { describe, expect, it, beforeEach } from "vitest";
import { createServiceRoutes } from "./services.js";
import { InMemoryConfigStore } from "../stores/in-memory-config-store.js";

function buildApp() {
  const configStore = new InMemoryConfigStore();
  const app = new Hono();
  app.route("/", createServiceRoutes({ configStore }));
  return { app, configStore };
}

const SEED_SERVICES = [
  { serviceId: "web", name: "Web", tier: "frontend", ownedPrefixes: ["page_view"], url: "http://localhost:5220" },
  { serviceId: "api", name: "API", tier: "backend", ownedPrefixes: ["endpoint"], gatewayPath: "/v1/api", stripPrefix: true, urls: { dev: "http://localhost:3200", prod: "https://api.prod" } },
  { serviceId: "gate", name: "Gate", tier: "infra", ownedPrefixes: [], gatewayPath: "/gate/", stripPrefix: true },
];

async function seedServices(configStore: InMemoryConfigStore) {
  await configStore.set("demo", "services", JSON.stringify(SEED_SERVICES));
}

describe("services routes", () => {
  let app: Hono;
  let configStore: InMemoryConfigStore;

  beforeEach(async () => {
    ({ app, configStore } = buildApp());
    await seedServices(configStore);
  });

  describe("GET /api/services", () => {
    it("전체 서비스 목록 반환", async () => {
      const res = await app.request("/api/services");
      const data = await res.json() as any[];
      expect(data).toHaveLength(3);
      expect(data.map((s: any) => s.serviceId)).toEqual(["web", "api", "gate"]);
    });

    it("빈 목록도 정상 반환", async () => {
      const { app: emptyApp } = buildApp();
      const res = await emptyApp.request("/api/services");
      expect(await res.json()).toEqual([]);
    });
  });

  describe("GET /api/services/:id", () => {
    it("단건 조회", async () => {
      const res = await app.request("/api/services/api");
      const data = await res.json() as any;
      expect(data.serviceId).toBe("api");
      expect(data.gatewayPath).toBe("/v1/api");
    });

    it("없는 서비스 → 404", async () => {
      const res = await app.request("/api/services/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/services/svc-owners", () => {
    it("prefix → 서비스 맵 반환", async () => {
      const res = await app.request("/api/services/svc-owners");
      const data = await res.json() as Record<string, string>;
      expect(data["page_view"]).toBe("web");
      expect(data["endpoint"]).toBe("api");
    });
  });

  describe("GET /api/services/gateway", () => {
    it("gatewayPath가 있는 서비스만 반환", async () => {
      const res = await app.request("/api/services/gateway?env=dev");
      const data = await res.json() as any;
      expect(data.routes).toHaveLength(2); // api + gate
      expect(data.env).toBe("dev");
    });

    it("strip 플래그 포함", async () => {
      const res = await app.request("/api/services/gateway?env=dev");
      const data = await res.json() as any;
      const apiRoute = data.routes.find((r: any) => r.serviceId === "api");
      expect(apiRoute.strip).toBe(true);
    });

    it("env=prod일 때 urls.prod 사용", async () => {
      const res = await app.request("/api/services/gateway?env=prod");
      const data = await res.json() as any;
      const apiRoute = data.routes.find((r: any) => r.serviceId === "api");
      expect(apiRoute.url).toBe("https://api.prod");
    });
  });

  describe("POST /api/services", () => {
    it("신규 서비스 추가", async () => {
      const res = await app.request("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: "new-svc", name: "New", ownedPrefixes: [] }),
      });
      const data = await res.json() as any;
      expect(data.ok).toBe(true);
      expect(data.action).toBe("created");

      // 확인
      const list = await (await app.request("/api/services")).json() as any[];
      expect(list).toHaveLength(4);
    });

    it("기존 서비스 업데이트", async () => {
      const res = await app.request("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: "web", name: "Web Updated", ownedPrefixes: ["page_view", "tracking"] }),
      });
      const data = await res.json() as any;
      expect(data.action).toBe("updated");
    });
  });

  describe("DELETE /api/services/:id", () => {
    it("서비스 삭제", async () => {
      const res = await app.request("/api/services/gate", { method: "DELETE" });
      const data = await res.json() as any;
      expect(data.ok).toBe(true);

      const list = await (await app.request("/api/services")).json() as any[];
      expect(list).toHaveLength(2);
    });
  });
});
