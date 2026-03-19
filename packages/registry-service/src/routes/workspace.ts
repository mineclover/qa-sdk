import { Hono } from "hono";
import type { RegistryService } from "../lib/registry-service.js";
import { simulate, analyze } from "../lib/draft-workspace.js";
import { simulateSchema } from "../schemas/workspace.js";

export interface WorkspaceRouteDeps {
  service: RegistryService;
}

export function createWorkspaceRoutes(deps: WorkspaceRouteDeps) {
  const routes = new Hono();
  const { service } = deps;

  routes.get("/workspace/drafts", async (c) => {
    const drafts = await service.getAllDrafts();
    return c.json(drafts);
  });

  routes.post("/workspace/simulate", async (c) => {
    const body = simulateSchema.parse(await c.req.json());
    const result = await simulate(
      service.prefixRegistry,
      service.ownerStore,
      service.versionStore,
      body.changes,
    );
    return c.json(result);
  });

  routes.post("/workspace/analyze", async (c) => {
    const result = await analyze(
      service.prefixRegistry,
      service.versionStore,
      service.ownerStore,
      (prefix, versionId) => service.isLocked(prefix, versionId),
    );
    return c.json(result);
  });

  routes.post("/workspace/lock-all", async (c) => {
    const result = await service.lockAll();
    return c.json(result);
  });

  routes.post("/workspace/release-all", async (c) => {
    const result = await service.releaseAll();
    return c.json(result);
  });

  return routes;
}
