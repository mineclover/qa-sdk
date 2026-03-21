import { Hono } from "hono";
import type { RegistryService } from "../lib/registry-service.js";
import {
  createDraftSchema,
  patchDraftSchema,
  listVersionsQuerySchema,
} from "../schemas/version.js";
import type { ExtendedVersionStatus } from "../types/index.js";

export interface VersionRouteDeps {
  service: RegistryService;
}

export function createVersionRoutes(deps: VersionRouteDeps) {
  const routes = new Hono();
  const { service } = deps;

  routes.post("/prefixes/:prefix/versions", async (c) => {
    const prefix = c.req.param("prefix");
    const body = createDraftSchema.parse(await c.req.json());
    const record = await service.createDraft({ prefix, ...body });
    return c.json(record, 201);
  });

  routes.get("/prefixes/:prefix/versions", async (c) => {
    const prefix = c.req.param("prefix");
    const query = listVersionsQuerySchema.parse(c.req.query());
    const versions = await service.listVersions(
      prefix,
      query.status as ExtendedVersionStatus | undefined,
    );
    return c.json(versions);
  });

  routes.get("/prefixes/:prefix/versions/:versionId", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    const record = await service.getVersion(prefix, versionId);
    return c.json(record);
  });

  routes.patch("/prefixes/:prefix/versions/:versionId", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    const body = patchDraftSchema.parse(await c.req.json());
    const record = await service.patchDraft(prefix, versionId, body);
    return c.json(record);
  });

  routes.post("/prefixes/:prefix/versions/:versionId/lock", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    await service.lockDraft(prefix, versionId);
    return c.json({ ok: true });
  });

  routes.post("/prefixes/:prefix/versions/:versionId/unlock", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    await service.unlockDraft(prefix, versionId);
    return c.json({ ok: true });
  });

  routes.post("/prefixes/:prefix/versions/:versionId/release", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    await service.release(prefix, versionId);
    return c.json({ ok: true });
  });

  routes.post("/prefixes/:prefix/versions/:versionId/activate", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    const result = await service.activate(prefix, versionId);
    return c.json(result);
  });

  routes.post("/prefixes/:prefix/versions/:versionId/deprecate", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("versionId");
    await service.deprecate(prefix, versionId);
    return c.json({ ok: true });
  });

  return routes;
}
