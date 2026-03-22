/**
 * /api/services — 서비스 등록/조회/삭제.
 *
 * Projection의 svcOwners 구성에 사용.
 * ServiceTopology 하드코딩 대신 registry에서 중앙 관리.
 */

import { Hono } from "hono";
import type { ConfigStore } from "../stores/config-store.js";
import type { ServiceEndpointStore } from "../stores/service-endpoint-store.js";

export interface ServiceRecord {
  readonly serviceId: string;
  readonly name: string;
  readonly tier?: "frontend" | "backend" | "infra" | "system";
  readonly team?: string;
  /** 기본 URL (현재 환경) */
  readonly url?: string;
  /** 환경별 URL (dev/staging/prod) */
  readonly urls?: Readonly<Record<string, string>>;
  /** 게이트웨이 경로 prefix (예: "/v1/ingest") */
  readonly gatewayPath?: string;
  readonly ownedPrefixes: readonly string[];
  readonly consumedPrefixes?: readonly string[];
}

export interface ServiceRouteDeps {
  configStore: ConfigStore;
  endpointStore?: ServiceEndpointStore;
}

const CONFIG_TYPE = "services";

function parseServices(data: string): ServiceRecord[] | null {
  try { return JSON.parse(data); } catch { return null; }
}

export function createServiceRoutes(deps: ServiceRouteDeps) {
  const routes = new Hono();
  const { configStore, endpointStore } = deps;

  // GET /api/services — 전체 서비스 목록
  routes.get("/api/services", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json([]);
    return c.json(parseServices(record.data) ?? []);
  });

  // GET /api/services/svc-owners — Projection용 svcOwners 맵 (반드시 :id보다 먼저)
  routes.get("/api/services/svc-owners", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json({});
    const services: ServiceRecord[] = parseServices(record.data) ?? [];
    const owners: Record<string, string> = {};
    for (const svc of services) {
      for (const prefixId of svc.ownedPrefixes) {
        owners[prefixId] = svc.serviceId;
      }
    }
    return c.json(owners);
  });

  // GET /api/services/urls — 서비스별 URL 맵 (config.js 등에서 소비)
  // ?env=dev|staging|prod → 환경별 URL 반환
  // 우선순위: endpoint 테이블 → ServiceRecord.urls[env] → ServiceRecord.url
  routes.get("/api/services/urls", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const envName = c.req.query("env") ?? "dev";
    const namespace = c.req.query("namespace") ?? "shop";
    const region = c.req.query("region") ?? "asia";

    const urls: Record<string, string> = {};

    // 1) endpoint 테이블에서 해당 env의 URL 조회 (우선)
    if (endpointStore) {
      const endpoints = await endpointStore.list(catalogId);
      for (const ep of endpoints) {
        if (ep.env === envName && ep.region === region && ep.namespace === namespace) {
          urls[ep.svcName] = ep.url;
        }
      }
    }

    // 2) ServiceRecord에서 보충 (endpoint에 없는 서비스)
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (record) {
      const services = parseServices(record.data) ?? [];
      for (const svc of services) {
        if (urls[svc.serviceId]) continue; // endpoint가 우선
        const envUrl = svc.urls ? svc.urls[envName] : undefined;
        const url = envUrl ?? svc.url;
        if (url) urls[svc.serviceId] = url;
      }
    }

    return c.json(urls);
  });

  // GET /api/services/gateway — 게이트웨이 라우팅 구성
  // 게이트웨이가 이 엔드포인트를 호출하여 동적으로 라우팅 테이블 구성 가능
  // URL 우선순위: endpoint 테이블 → ServiceRecord.urls[env] → ServiceRecord.url
  routes.get("/api/services/gateway", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const envName = c.req.query("env") ?? "dev";
    const namespace = c.req.query("namespace") ?? "shop";
    const region = c.req.query("region") ?? "asia";

    // endpoint 테이블에서 URL 맵 구성
    const epUrls: Record<string, string> = {};
    if (endpointStore) {
      const endpoints = await endpointStore.list(catalogId);
      for (const ep of endpoints) {
        if (ep.env === envName && ep.region === region && ep.namespace === namespace) {
          epUrls[ep.svcName] = ep.url;
        }
      }
    }

    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json({ routes: [], env: envName });
    const services = parseServices(record.data) ?? [];
    const routes_list = services
      .filter(svc => svc.gatewayPath)
      .map(svc => ({
        path: svc.gatewayPath!,
        serviceId: svc.serviceId,
        url: epUrls[svc.serviceId] ?? svc.urls?.[envName] ?? svc.url ?? "",
        tier: svc.tier ?? "backend",
      }));
    return c.json({ routes: routes_list, env: envName });
  });

  // GET /api/services/:id — 단건 조회
  routes.get("/api/services/:id", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const serviceId = c.req.param("id");
    const record = await configStore.get(catalogId, CONFIG_TYPE);
    if (!record) return c.json({ error: "Services not found" }, 404);
    const services: ServiceRecord[] = parseServices(record.data) ?? [];
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
    const services: ServiceRecord[] = record ? parseServices(record.data) ?? [] : [];
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
    const services: ServiceRecord[] = parseServices(record.data) ?? [];
    const filtered = services.filter(s => s.serviceId !== serviceId);
    if (filtered.length === services.length) {
      return c.json({ error: `Service '${serviceId}' not found` }, 404);
    }
    await configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(filtered));
    return c.json({ ok: true, serviceId });
  });

  return routes;
}
