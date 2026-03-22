/**
 * /api/event-schemas — 서비스별 이벤트 스키마 CRUD.
 *
 * registry-server의 service_events 기능을 흡수.
 * 서비스가 발행하는 이벤트의 키, 버전, recordKind를 중앙 관리.
 */

import { Hono } from "hono";
import type { EventSchemaStore, EventSchemaRecord } from "../stores/event-schema-store.js";

export interface EventSchemaRouteDeps {
  eventSchemaStore: EventSchemaStore;
}

export function createEventSchemaRoutes(deps: EventSchemaRouteDeps) {
  const routes = new Hono();
  const { eventSchemaStore } = deps;

  // GET /api/event-schemas — 전체 목록
  routes.get("/api/event-schemas", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const serviceId = c.req.query("service");
    const records = serviceId
      ? await eventSchemaStore.listByService(catalogId, serviceId)
      : await eventSchemaStore.list(catalogId);
    return c.json(records);
  });

  // GET /api/event-schemas/:serviceId/:eventKey — 이벤트 버전 목록
  routes.get("/api/event-schemas/:serviceId/:eventKey", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const serviceId = c.req.param("serviceId");
    const eventKey = c.req.param("eventKey");
    const all = await eventSchemaStore.listByService(catalogId, serviceId);
    const filtered = all.filter(r => r.eventKey === eventKey);
    if (filtered.length === 0) {
      return c.json({ error: `Event '${serviceId}/${eventKey}' not found` }, 404);
    }
    return c.json({ serviceId, eventKey, versions: filtered });
  });

  // GET /api/event-schemas/:serviceId/:eventKey/:version — 단건 조회
  routes.get("/api/event-schemas/:serviceId/:eventKey/:version", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await eventSchemaStore.get(
      catalogId, c.req.param("serviceId"), c.req.param("eventKey"), c.req.param("version"),
    );
    if (!record) return c.json({ error: "Event schema not found" }, 404);
    return c.json(record);
  });

  // PUT /api/event-schemas/:serviceId/:eventKey/:version — 등록/업데이트
  routes.put("/api/event-schemas/:serviceId/:eventKey/:version", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const serviceId = c.req.param("serviceId");
    const eventKey = c.req.param("eventKey");
    const eventVersion = c.req.param("version");
    const body = await c.req.json<{
      displayName?: string;
      description?: string;
      recordKind?: "log" | "span" | "both";
      status?: "active" | "deprecated" | "retired";
    }>();

    const now = new Date().toISOString();
    const existing = await eventSchemaStore.get(catalogId, serviceId, eventKey, eventVersion);

    const record: EventSchemaRecord = {
      catalogId,
      serviceId,
      eventKey,
      eventVersion,
      displayName: body.displayName ?? existing?.displayName ?? eventKey,
      description: body.description ?? existing?.description,
      recordKind: body.recordKind ?? existing?.recordKind ?? "log",
      status: body.status ?? existing?.status ?? "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await eventSchemaStore.upsert(record);
    return c.json({ ok: true, action: existing ? "updated" : "created" });
  });

  // DELETE /api/event-schemas/:serviceId/:eventKey/:version — 삭제
  routes.delete("/api/event-schemas/:serviceId/:eventKey/:version", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const deleted = await eventSchemaStore.delete(
      catalogId, c.req.param("serviceId"), c.req.param("eventKey"), c.req.param("version"),
    );
    if (!deleted) return c.json({ error: "Event schema not found" }, 404);
    return c.json({ ok: true });
  });

  // ── 하위 호환: registry-server의 RegistryClient.validateEvent()가 호출하는 경로 ──
  // GET /services/:name/events/:key/versions/:ver
  // serviceName은 "namespace/name" 형식일 수 있으므로 "name" 부분만 추출
  routes.get("/services/:name/events/:key/versions/:ver", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const rawName = decodeURIComponent(c.req.param("name"));
    const serviceId = rawName.includes("/") ? rawName.split("/").pop()! : rawName;
    const record = await eventSchemaStore.get(
      catalogId, serviceId, c.req.param("key"), c.req.param("ver"),
    );
    if (!record) return c.json({ error: "Event not found" }, 404);
    return c.json(record);
  });

  return routes;
}
