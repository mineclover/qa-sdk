import { Hono } from "hono";
import type { RegistryService } from "../lib/registry-service.js";
import { prefixNotFound, badRequest } from "../lib/errors.js";

export interface ResolveRouteDeps {
  service: RegistryService;
}

export function createResolveRoutes(deps: ResolveRouteDeps) {
  const routes = new Hono();
  const { service } = deps;

  routes.get("/resolve/active", async (c) => {
    const result = await service.resolveAllActive();
    return c.json(result);
  });

  routes.get("/resolve/active/:prefix", async (c) => {
    const prefix = c.req.param("prefix");
    const active = await service.getActiveEnriched(prefix);
    if (!active) throw prefixNotFound(prefix);
    return c.json(active);
  });

  routes.get("/resolve/manifest", async (c) => {
    const manifest = await service.resolveManifest();
    return c.json(manifest);
  });

  // ── Inspect: 3-level prefix version query ───────────

  /** Level 1 — 메타만 (dims, capacity, stride, kind, status) */
  routes.get("/inspect/:prefix/:versionId/meta", async (c) => {
    const { prefix, versionId } = c.req.param();
    const meta = await service.inspectMeta(prefix, versionId);
    return c.json(meta);
  });

  /** Level 2 — 메타 + 인덱스 키 (주소 범위, 축별 entry 개수) */
  routes.get("/inspect/:prefix/:versionId/keys", async (c) => {
    const { prefix, versionId } = c.req.param();
    const keys = await service.inspectKeys(prefix, versionId);
    return c.json(keys);
  });

  /** Level 3 — 메타 + 특정 주소의 밸류 (좌표 디코드) */
  routes.get("/inspect/:prefix/:versionId/value/:address", async (c) => {
    const { prefix, versionId, address } = c.req.param();
    const addr = Number(address);
    if (!Number.isFinite(addr) || addr < 0) {
      throw badRequest(`유효하지 않은 주소: ${address}`);
    }
    const value = await service.inspectValue(prefix, versionId, addr);
    return c.json(value);
  });

  return routes;
}
