/**
 * /api/services — 서비스 등록/조회/삭제.
 *
 * Projection의 svcOwners 구성에 사용.
 * ServiceTopology 하드코딩 대신 registry에서 중앙 관리.
 */

import { Hono } from "hono";
import type { ConfigStore } from "../stores/config-store.js";

export interface ServiceRecord {
  readonly serviceId: string;
  readonly name: string;
  readonly tier?: "frontend" | "backend" | "infra" | "system";
  readonly team?: string;
  readonly ownedPrefixes: readonly string[];
  readonly consumedPrefixes?: readonly string[];
}

export interface ServiceRouteDeps {
  configStore: ConfigStore;
}

const CONFIG_TYPE = "services";

export function createServiceRoutes(deps: ServiceRouteDeps) {
  const routes = new Hono();
  const { configStore } = deps;

  // GET /api/services — 전체 서비스 목록
  routes.get("/api/services", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json([]);
    return c.json(JSON.parse(record.data));
  });

  // GET /api/services/svc-owners — Projection용 svcOwners 맵 (반드시 :id보다 먼저)
  routes.get("/api/services/svc-owners", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json({});
    const services: ServiceRecord[] = JSON.parse(record.data);
    const owners: Record<string, string> = {};
    for (const svc of services) {
      for (const prefixId of svc.ownedPrefixes) {
        owners[prefixId] = svc.serviceId;
      }
    }
    return c.json(owners);
  });

  // GET /api/services/:id — 단건 조회
  routes.get("/api/services/:id", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const serviceId = c.req.param("id");
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json({ error: "Services not found" }, 404);
    const services: ServiceRecord[] = JSON.parse(record.data);
    const found = services.find(s => s.serviceId === serviceId);
    if (!found) return c.json({ error: `Service '${serviceId}' not found` }, 404);
    return c.json(found);
  });

  // PUT /api/services — 전체 서비스 목록 교체
  routes.put("/api/services", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const body = await c.req.json<{ services: ServiceRecord[] }>();
    if (!body.services || !Array.isArray(body.services)) {
      return c.json({ error: "services 배열 필수" }, 400);
    }
    await configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(body.services));
    return c.json({ ok: true, count: body.services.length });
  });

  // POST /api/services — 단건 추가/업데이트
  routes.post("/api/services", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const body = await c.req.json<ServiceRecord>();
    if (!body.serviceId || !body.name) {
      return c.json({ error: "serviceId, name 필수" }, 400);
    }

    const record = await configStore.get(catalogId, CONFIG_TYPE);
    const services: ServiceRecord[] = record ? JSON.parse(record.data) : [];
    const idx = services.findIndex(s => s.serviceId === body.serviceId);
    if (idx >= 0) {
      services[idx] = body;
    } else {
      services.push(body);
    }
    await configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(services));
    return c.json({ ok: true, serviceId: body.serviceId, action: idx >= 0 ? "updated" : "created" });
  });

  // DELETE /api/services/:id — 단건 삭제
  routes.delete("/api/services/:id", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const serviceId = c.req.param("id");
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json({ error: "Services not found" }, 404);
    const services: ServiceRecord[] = JSON.parse(record.data);
    const filtered = services.filter(s => s.serviceId !== serviceId);
    if (filtered.length === services.length) {
      return c.json({ error: `Service '${serviceId}' not found` }, 404);
    }
    await configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(filtered));
    return c.json({ ok: true, serviceId });
  });

  return routes;
}
