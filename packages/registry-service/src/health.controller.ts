// @def.boundary registry-system
// @def.doc registry-system

import { createHash } from "node:crypto";
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from "@nestjs/common";
import type { CatalogStore } from "./stores/catalog-store.js";
import type { ConfigStore } from "./stores/config-store.js";
import { CATALOG_STORE, CONFIG_STORE } from "./modules/catalog/catalog.service.js";

@Controller()
export class HealthController {
  constructor(
    @Optional() @Inject(CATALOG_STORE) private readonly catalogStore?: CatalogStore,
    @Optional() @Inject(CONFIG_STORE) private readonly configStore?: ConfigStore,
  ) {}

  @Get("health")
  health() {
    return { ok: true, service: "registry-service" };
  }

  @Get("health/live")
  live() {
    return { ok: true };
  }

  @Get("health/generation")
  async generation() {
    if (!this.catalogStore) {
      throw new HttpException({ error: "catalogStore not available" }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const catalogs = await this.catalogStore.list();
    const generations: Record<string, {
      catalogHash: string;
      dkgConfigHash: string | null;
      prefixCount: number;
      axisCount: number;
      updatedAt: string;
    }> = {};

    for (const catalog of catalogs) {
      const catalogHash = createHash("sha256").update(catalog.data).digest("hex").slice(0, 12);
      const dkgConfigRecord = await this.configStore?.get(catalog.id, "dkg-config");
      const dkgConfigHash = dkgConfigRecord?.data
        ? createHash("sha256").update(dkgConfigRecord.data).digest("hex").slice(0, 12)
        : null;

      let prefixCount = 0;
      let axisCount = 0;
      try {
        const parsed = JSON.parse(catalog.data) as {
          prefixes?: Record<string, unknown>;
          axes?: Record<string, unknown>;
        };
        prefixCount = Object.keys(parsed.prefixes ?? {}).length;
        axisCount = Object.keys(parsed.axes ?? {}).length;
      } catch {
        prefixCount = 0;
        axisCount = 0;
      }

      generations[catalog.id] = {
        catalogHash,
        dkgConfigHash,
        prefixCount,
        axisCount,
        updatedAt: catalog.updatedAt,
      };
    }

    return { service: "registry-service", generations };
  }
}
