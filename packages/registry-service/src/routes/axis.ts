import { Hono } from "hono";
import type { AxisProfileStore, AxisProfilePatch } from "../stores/axis-profile-store.js";

export interface AxisRouteDeps {
  axisStore: AxisProfileStore;
  onAxisChange?: (catalogId: string, axisId: string) => void;
}

export function createAxisRoutes(deps: AxisRouteDeps) {
  const routes = new Hono();
  const { axisStore, onAxisChange } = deps;

  // GET /catalogs/:catalogId/axes — 목록
  routes.get("/catalogs/:catalogId/axes", async (c) => {
    const catalogId = c.req.param("catalogId");
    const list = await axisStore.list(catalogId);
    return c.json(list);
  });

  // GET /catalogs/:catalogId/axes/:id — 단건
  routes.get("/catalogs/:catalogId/axes/:id", async (c) => {
    const catalogId = c.req.param("catalogId");
    const id = c.req.param("id");
    const record = await axisStore.get(id, catalogId);
    if (!record) return c.json({ error: `Axis '${id}' not found` }, 404);
    return c.json(record);
  });

  // PATCH /catalogs/:catalogId/axes/:id — 프로필 패치
  routes.patch("/catalogs/:catalogId/axes/:id", async (c) => {
    const catalogId = c.req.param("catalogId");
    const id = c.req.param("id");
    const body = await c.req.json<AxisProfilePatch>();

    const existing = await axisStore.get(id, catalogId);
    if (!existing) return c.json({ error: `Axis '${id}' not found` }, 404);

    await axisStore.patch(id, catalogId, body);
    onAxisChange?.(catalogId, id);

    const updated = await axisStore.get(id, catalogId);
    return c.json(updated);
  });

  // POST /catalogs/:catalogId/axes — 새 축 등록
  routes.post("/catalogs/:catalogId/axes", async (c) => {
    const catalogId = c.req.param("catalogId");
    const body = await c.req.json<{
      id: string; name: string; capacity?: number; entryCount?: number;
    }>();

    if (!body.id || !body.name) {
      return c.json({ error: "id, name 필수" }, 400);
    }

    const existing = await axisStore.get(body.id, catalogId);
    if (existing) return c.json({ error: `Axis '${body.id}' already exists` }, 409);

    const now = new Date().toISOString();
    await axisStore.register({
      id: body.id,
      catalogId,
      name: body.name,
      currentVersion: "v1",
      capacity: body.capacity ?? 32,
      entryCount: body.entryCount ?? 0,
      updatedAt: now,
    });

    onAxisChange?.(catalogId, body.id);
    const created = await axisStore.get(body.id, catalogId);
    return c.json(created, 201);
  });

  // POST /catalogs/:catalogId/axes/:id/entries — entry 추가 (향후 safe-entry-add 연동)
  routes.post("/catalogs/:catalogId/axes/:id/entries", async (c) => {
    const catalogId = c.req.param("catalogId");
    const id = c.req.param("id");
    const body = await c.req.json<{ entry: string }>();

    if (!body.entry) return c.json({ error: "entry 필수" }, 400);

    const existing = await axisStore.get(id, catalogId);
    if (!existing) return c.json({ error: `Axis '${id}' not found` }, 404);

    // headroom 체크
    if (existing.entryCount >= existing.capacity) {
      return c.json({
        error: `Axis '${id}' has no headroom (${existing.entryCount}/${existing.capacity}). Increase capacity first.`,
        headroom: 0,
      }, 409);
    }

    // entryCount 증가
    await axisStore.patch(id, catalogId, { entryCount: existing.entryCount + 1 });
    onAxisChange?.(catalogId, id);

    return c.json({
      ok: true,
      entry: body.entry,
      entryCount: existing.entryCount + 1,
      headroom: existing.capacity - existing.entryCount - 1,
    });
  });

  // DELETE /catalogs/:catalogId/axes/:id
  routes.delete("/catalogs/:catalogId/axes/:id", async (c) => {
    const catalogId = c.req.param("catalogId");
    const id = c.req.param("id");
    const existing = await axisStore.get(id, catalogId);
    if (!existing) return c.json({ error: `Axis '${id}' not found` }, 404);
    await axisStore.delete(id, catalogId);
    onAxisChange?.(catalogId, id);
    return c.json({ ok: true });
  });

  return routes;
}
