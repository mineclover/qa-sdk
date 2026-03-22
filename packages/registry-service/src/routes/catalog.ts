import { Hono } from "hono";
import type { CatalogStore } from "../stores/catalog-store.js";
import type { ConfigStore } from "../stores/config-store.js";

export interface CatalogRouteDeps {
  catalogStore: CatalogStore;
  /** catalog 변경 시 호출되는 콜백 (캐시 무효화 등) */
  onCatalogChange?: (catalogId: string) => void;
  /** 통합 설정 저장소 (DkgConfig, PatternRules 등) */
  configStore?: ConfigStore;
}

export function createCatalogRoutes(deps: CatalogRouteDeps) {
  const routes = new Hono();
  const { catalogStore, onCatalogChange, configStore } = deps;

  // POST /catalogs — 카탈로그 등록
  routes.post("/catalogs", async (c) => {
    const body = await c.req.json<{ id: string; name: string; data: string }>();
    if (!body.id || !body.name || !body.data) {
      return c.json({ error: "id, name, data 필수" }, 400);
    }

    const existing = await catalogStore.get(body.id);
    if (existing) {
      return c.json({ error: `Catalog '${body.id}' already exists` }, 409);
    }

    const now = new Date().toISOString();
    await catalogStore.register({
      id: body.id,
      name: body.name,
      data: body.data,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({ id: body.id, name: body.name, createdAt: now }, 201);
  });

  // GET /catalogs — 목록 조회
  routes.get("/catalogs", async (c) => {
    const list = await catalogStore.list();
    return c.json(list.map(r => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt,
    })));
  });

  // GET /catalogs/:id — 단건 조회
  routes.get("/catalogs/:id", async (c) => {
    const id = c.req.param("id");
    const record = await catalogStore.get(id);
    if (!record) {
      return c.json({ error: `Catalog '${id}' not found` }, 404);
    }
    return c.json(record);
  });

  // PUT /catalogs/:id — 업데이트
  routes.put("/catalogs/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await catalogStore.get(id);
    if (!existing) {
      return c.json({ error: `Catalog '${id}' not found` }, 404);
    }

    const body = await c.req.json<{ name?: string; data?: string }>();
    await catalogStore.update(
      id,
      body.name ?? existing.name,
      body.data ?? existing.data,
    );

    const updated = await catalogStore.get(id);
    onCatalogChange?.(id);
    return c.json(updated);
  });

  // DELETE /catalogs/:id — 삭제
  routes.delete("/catalogs/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await catalogStore.get(id);
    if (!existing) {
      return c.json({ error: `Catalog '${id}' not found` }, 404);
    }
    await catalogStore.delete(id);
    onCatalogChange?.(id);
    return c.json({ ok: true });
  });

  // GET /catalogs/:id/prefixes — 카탈로그 내 prefix 목록
  routes.get("/catalogs/:id/prefixes", async (c) => {
    const id = c.req.param("id");
    const record = await catalogStore.get(id);
    if (!record) {
      return c.json({ error: `Catalog '${id}' not found` }, 404);
    }

    try {
      const catalog = JSON.parse(record.data) as { prefixes?: Record<string, { id: string; name: string; labels?: string[] }> };
      const prefixes = catalog.prefixes
        ? Object.entries(catalog.prefixes).map(([pid, p]) => ({
            id: pid,
            name: p.name,
            dims: p.labels?.length ?? 0,
          }))
        : [];
      return c.json(prefixes);
    } catch {
      return c.json({ error: "카탈로그 데이터 파싱 실패" }, 500);
    }
  });

  // ── 통합 설정 API (DkgConfig, PatternRules 등) ──

  // GET /catalogs/:id/config — DkgConfig 조회
  routes.get("/catalogs/:id/config", async (c) => {
    const id = c.req.param("id");
    if (!configStore) return c.json({ error: "configStore not available" }, 503);
    const record = await configStore.get(id, "dkg-config");
    if (!record) return c.json({ error: `DkgConfig for catalog '${id}' not found` }, 404);
    return c.json({ catalogId: id, data: record.data });
  });

  // PUT /catalogs/:id/config — DkgConfig 저장/업데이트
  routes.put("/catalogs/:id/config", async (c) => {
    const id = c.req.param("id");
    const existing = await catalogStore.get(id);
    if (!existing) return c.json({ error: `Catalog '${id}' not found` }, 404);
    if (!configStore) return c.json({ error: "configStore not available" }, 503);
    const body = await c.req.json<{ data: string }>();
    if (!body.data) return c.json({ error: "data (DkgConfig JSON) 필수" }, 400);
    await configStore.set(id, "dkg-config", body.data);
    return c.json({ catalogId: id, ok: true });
  });

  // GET /catalogs/:id/pattern-rules — PatternRules 조회
  routes.get("/catalogs/:id/pattern-rules", async (c) => {
    const id = c.req.param("id");
    if (!configStore) return c.json({ error: "configStore not available" }, 503);
    const record = await configStore.get(id, "pattern-rules");
    if (!record) return c.json({ error: `PatternRules for catalog '${id}' not found` }, 404);
    return c.json({ catalogId: id, data: record.data });
  });

  // PUT /catalogs/:id/pattern-rules — PatternRules 저장/업데이트
  routes.put("/catalogs/:id/pattern-rules", async (c) => {
    const id = c.req.param("id");
    const existing = await catalogStore.get(id);
    if (!existing) return c.json({ error: `Catalog '${id}' not found` }, 404);
    if (!configStore) return c.json({ error: "configStore not available" }, 503);
    const body = await c.req.json<{ data: string }>();
    if (!body.data) return c.json({ error: "data (PatternRules JSON) 필수" }, 400);
    await configStore.set(id, "pattern-rules", body.data);
    return c.json({ catalogId: id, ok: true });
  });

  // GET /catalogs/:id/configs — 모든 설정 타입 목록
  routes.get("/catalogs/:id/configs", async (c) => {
    const id = c.req.param("id");
    if (!configStore) return c.json({ error: "configStore not available" }, 503);
    const records = await configStore.list(id);
    return c.json(records.map(r => ({ configType: r.configType, updatedAt: r.updatedAt })));
  });

  return routes;
}
