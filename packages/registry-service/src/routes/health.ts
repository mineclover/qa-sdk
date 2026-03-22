import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { CatalogStore } from "../stores/catalog-store.js";
import type { ConfigStore } from "../stores/config-store.js";

export interface HealthRouteDeps {
  catalogStore?: CatalogStore;
  configStore?: ConfigStore;
}

export function createHealthRoutes(deps?: HealthRouteDeps) {
  const routes = new Hono();

  routes.get("/health", (c) =>
    c.json({ ok: true, service: "registry-service" }),
  );

  routes.get("/health/live", (c) => c.json({ ok: true }));

  /**
   * GET /health/generation — catalog/config version 정보 노출.
   * SDK 부트 시 GENERATION과 비교하여 불일치 감지.
   */
  routes.get("/health/generation", async (c) => {
    if (!deps?.catalogStore) {
      return c.json({ error: "catalogStore not available" }, 503);
    }

    const catalogs = await deps.catalogStore.list();
    const generations: Record<string, {
      catalogHash: string;
      dkgConfigHash: string | null;
      prefixCount: number;
      axisCount: number;
      updatedAt: string;
    }> = {};

    for (const catalog of catalogs) {
      const catalogHash = createHash("sha256").update(catalog.data).digest("hex").slice(0, 12);
      const dkgConfigRecord = await deps.configStore?.get(catalog.id, "dkg-config");
      const dkgConfigData = dkgConfigRecord?.data;
      const dkgConfigHash = dkgConfigData
        ? createHash("sha256").update(dkgConfigData).digest("hex").slice(0, 12)
        : null;

      let prefixCount = 0;
      let axisCount = 0;
      try {
        const parsed = JSON.parse(catalog.data);
        prefixCount = Object.keys(parsed.prefixes ?? {}).length;
        axisCount = Object.keys(parsed.axes ?? {}).length;
      } catch { /* parse 실패 시 0 */ }

      generations[catalog.id] = {
        catalogHash,
        dkgConfigHash,
        prefixCount,
        axisCount,
        updatedAt: catalog.updatedAt,
      };
    }

    return c.json({ service: "registry-service", generations });
  });

  return routes;
}
