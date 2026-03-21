import { Hono } from "hono";
import type { RegistryService } from "../lib/registry-service.js";
import { registerPrefixSchema } from "../schemas/prefix.js";

export interface PrefixRouteDeps {
  service: RegistryService;
}

export function createPrefixRoutes(deps: PrefixRouteDeps) {
  const routes = new Hono();
  const { service } = deps;

  routes.post("/prefixes", async (c) => {
    const body = registerPrefixSchema.parse(await c.req.json());
    const record = await service.registerPrefix(body);
    return c.json(record, 201);
  });

  routes.get("/prefixes", async (c) => {
    const list = await service.listPrefixes();
    return c.json(list);
  });

  routes.get("/prefixes/:prefix", async (c) => {
    const prefix = c.req.param("prefix");
    const record = await service.getPrefix(prefix);
    const versions = await service.listVersions(prefix);
    return c.json({ ...record, versions });
  });

  routes.patch("/prefixes/:prefix", async (c) => {
    const prefix = c.req.param("prefix");
    const body = await c.req.json<{ name?: string; category?: string; meta?: Record<string, unknown>; labels?: string[] }>();
    const patch: import("../stores/prefix-owner-store.js").PrefixProfilePatch = {};
    if (body.name) patch.name = body.name;
    if (body.labels) patch.labels = body.labels;
    if (body.category || body.meta) {
      patch.meta = {
        ...(body.category ? { category: body.category } : {}),
        ...(body.meta ?? {}),
      };
    }

    // category 변경 시 유효성 경고 (blocking 하지 않음)
    const diagnostics: string[] = [];
    if (body.category) {
      const validCategories = ["entity", "event", "relation", "state", "policy", "observation"];
      if (!validCategories.includes(body.category)) {
        diagnostics.push(`'${body.category}'는 유효한 카테고리가 아닙니다. 유효값: ${validCategories.join(", ")}`);
      }
    }

    const updated = await service.patchPrefix(prefix, patch);
    return c.json({ ...updated, ...(diagnostics.length > 0 ? { diagnostics } : {}) });
  });

  routes.delete("/prefixes/:prefix", async (c) => {
    const prefix = c.req.param("prefix");
    await service.deletePrefix(prefix);
    return c.json({ ok: true });
  });

  return routes;
}
