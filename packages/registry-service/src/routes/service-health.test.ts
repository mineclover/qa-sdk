/**
 * service-health 라우트 단위 테스트.
 *
 * NestJS 패턴: 의존성(configStore, endpointStore, serviceBindings)을 주입하여
 * 라우트 로직만 격리 테스트. 실제 네트워크 호출 없음.
 */

import { Hono } from "hono";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createServiceHealthRoutes, type ServiceHealthRouteDeps } from "./service-health.js";
import type { ConfigStore } from "../stores/config-store.js";

function mockConfigStore(services: unknown[]): ConfigStore {
  return {
    get: vi.fn().mockResolvedValue({ data: JSON.stringify(services) }),
    set: vi.fn(),
    delete: vi.fn(),
  } as unknown as ConfigStore;
}

function mockBinding(status: number, body: unknown): Fetcher {
  return {
    fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  };
}

function mockBindingError(message: string): Fetcher {
  return {
    fetch: vi.fn().mockRejectedValue(new Error(message)),
  };
}

function buildApp(deps: ServiceHealthRouteDeps) {
  const app = new Hono();
  app.route("/", createServiceHealthRoutes(deps));
  return app;
}

const SERVICES = [
  { serviceId: "ingest-server", name: "Ingest", tier: "infra", url: "https://ingest.test", urls: { prod: "https://ingest.prod" } },
  { serviceId: "gate-service", name: "Gate", tier: "infra", url: "https://gate.test" },
  { serviceId: "registry-service", name: "Registry", tier: "infra", url: "https://registry.test" },
  { serviceId: "local-only", name: "Local", tier: "infra", url: "http://localhost:9090" },
];

describe("service-health", () => {
  describe("GET /api/health/services", () => {
    it("Service Binding 사용 시 직접 호출", async () => {
      const bindings: Record<string, Fetcher> = {
        "ingest-server": mockBinding(200, { ok: true }),
        "gate-service": mockBinding(200, { status: "ok" }),
      };

      const app = buildApp({
        configStore: mockConfigStore(SERVICES),
        serviceBindings: bindings,
      });

      const res = await app.request("/api/health/services?env=dev");
      expect(res.status).toBe(200);
      const d = await res.json() as any;

      // ingest: binding 호출됨
      const ingest = d.services.find((s: any) => s.serviceId === "ingest-server");
      expect(ingest.status).toBe("up");
      expect((bindings["ingest-server"].fetch as any)).toHaveBeenCalled();
    });

    it("registry-service는 self-check (항상 up)", async () => {
      const app = buildApp({ configStore: mockConfigStore(SERVICES) });
      const res = await app.request("/api/health/services?env=dev");
      const d = await res.json() as any;

      const registry = d.services.find((s: any) => s.serviceId === "registry-service");
      expect(registry.status).toBe("up");
      expect(registry.latencyMs).toBe(0);
    });

    it("localhost URL은 필터링됨", async () => {
      const app = buildApp({ configStore: mockConfigStore(SERVICES) });
      const res = await app.request("/api/health/services?env=dev");
      const d = await res.json() as any;

      const localSvc = d.services.find((s: any) => s.serviceId === "local-only");
      expect(localSvc).toBeUndefined();
    });

    it("binding 에러 시 down 상태 반환", async () => {
      const bindings: Record<string, Fetcher> = {
        "gate-service": mockBindingError("Connection refused"),
      };

      const app = buildApp({
        configStore: mockConfigStore(SERVICES),
        serviceBindings: bindings,
      });

      const res = await app.request("/api/health/services?env=dev");
      const d = await res.json() as any;

      const gate = d.services.find((s: any) => s.serviceId === "gate-service");
      expect(gate.status).toBe("down");
      expect(gate.error).toContain("Connection refused");
    });

    it("전체 healthy/degraded/unhealthy 판정", async () => {
      const allUp: Record<string, Fetcher> = {
        "ingest-server": mockBinding(200, { ok: true }),
        "gate-service": mockBinding(200, { ok: true }),
      };

      const app = buildApp({
        configStore: mockConfigStore(SERVICES),
        serviceBindings: allUp,
      });

      const res = await app.request("/api/health/services?env=dev");
      const d = await res.json() as any;

      // registry(self) + ingest + gate = 3 up, 0 down
      expect(d.status).toBe("healthy");
      expect(d.up).toBeGreaterThan(0);
      expect(d.down).toBe(0);
    });

    it("env=prod일 때 urls.prod 사용", async () => {
      const bindings: Record<string, Fetcher> = {
        "ingest-server": mockBinding(200, { ok: true }),
        "gate-service": mockBinding(200, { ok: true }),
      };

      const app = buildApp({
        configStore: mockConfigStore(SERVICES),
        serviceBindings: bindings,
      });

      const res = await app.request("/api/health/services?env=prod");
      const d = await res.json() as any;

      const ingest = d.services.find((s: any) => s.serviceId === "ingest-server");
      expect(ingest.url).toBe("https://ingest.prod");
    });
  });
});
