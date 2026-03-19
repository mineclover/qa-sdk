import { Hono } from "hono";
import type { RegistryService } from "../lib/registry-service.js";

export interface DagRouteDeps {
  service: RegistryService;
}

export function createDagRoutes(deps: DagRouteDeps) {
  const routes = new Hono();
  const { service } = deps;

  routes.get("/dag/:prefix/:versionId/deps", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    const deps = await service.getDeps(prefix, versionId);
    return c.json(deps);
  });

  routes.get("/dag/:prefix/:versionId/deps/transitive", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    const deps = await service.getTransitiveDeps(prefix, versionId);
    return c.json(deps);
  });

  routes.get("/dag/:prefix/:versionId/reverse-refs", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    const refs = await service.getReverseRefs(prefix, versionId);
    return c.json(refs);
  });

  routes.get("/dag/graph", async (c) => {
    const graph = await service.getDagGraph();
    return c.json(graph);
  });

  return routes;
}
