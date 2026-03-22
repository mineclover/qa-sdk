/**
 * /api/endpoints — 좌표계 기반 서비스 URL 관리.
 *
 * composite key: (catalogId, namespace, svcName, env, region)
 * = service prefix 4축과 일치.
 */

import { Hono } from "hono";
import type { ServiceEndpointStore } from "../stores/service-endpoint-store.js";

export interface EndpointRouteDeps {
  endpointStore: ServiceEndpointStore;
}

export function createEndpointRoutes(deps: EndpointRouteDeps) {
  const routes = new Hono();
  const { endpointStore } = deps;

  // GET /api/endpoints — 전체 목록
  routes.get("/api/endpoints", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const records = await endpointStore.list(catalogId);
    return c.json(records);
  });

  // GET /api/endpoints/resolve — ServiceBootConfig로 URL resolve
  routes.get("/api/endpoints/resolve", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const namespace = c.req.query("namespace");
    const name = c.req.query("name");
    const env = c.req.query("env");
    const region = c.req.query("region");

    if (!namespace || !name || !env || !region) {
      return c.json({ error: "namespace, name, env, region 필수" }, 400);
    }

    const record = await endpointStore.get(catalogId, namespace, name, env, region);
    if (!record) {
      return c.json({ error: `Endpoint not found: ${namespace}/${name}@${env}.${region}` }, 404);
    }
    return c.json({ url: record.url });
  });

  // GET /api/endpoints/:ns/:svc — 서비스별 환경 목록
  routes.get("/api/endpoints/:ns/:svc", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const ns = c.req.param("ns");
    const svc = c.req.param("svc");
    const records = await endpointStore.listByService(catalogId, ns, svc);
    return c.json(records);
  });

  // GET /api/endpoints/:ns/:svc/:env/:region — 단건 조회
  routes.get("/api/endpoints/:ns/:svc/:env/:region", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await endpointStore.get(
      catalogId, c.req.param("ns"), c.req.param("svc"), c.req.param("env"), c.req.param("region"),
    );
    if (!record) return c.json({ error: "Endpoint not found" }, 404);
    return c.json(record);
  });

  // PUT /api/endpoints/:ns/:svc/:env/:region — 등록/업데이트
  routes.put("/api/endpoints/:ns/:svc/:env/:region", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const body = await c.req.json<{ url: string }>();
    if (!body.url) return c.json({ error: "url 필수" }, 400);

    await endpointStore.upsert({
      catalogId,
      namespace: c.req.param("ns"),
      svcName: c.req.param("svc"),
      env: c.req.param("env"),
      region: c.req.param("region"),
      url: body.url,
      updatedAt: new Date().toISOString(),
    });
    return c.json({ ok: true });
  });

  // DELETE /api/endpoints/:ns/:svc/:env/:region
  routes.delete("/api/endpoints/:ns/:svc/:env/:region", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    await endpointStore.delete(
      catalogId, c.req.param("ns"), c.req.param("svc"), c.req.param("env"), c.req.param("region"),
    );
    return c.json({ ok: true });
  });

  return routes;
}
