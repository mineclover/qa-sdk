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

  routes.delete("/prefixes/:prefix", async (c) => {
    const prefix = c.req.param("prefix");
    await service.deletePrefix(prefix);
    return c.json({ ok: true });
  });

  return routes;
}
