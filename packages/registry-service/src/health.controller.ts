// @def.boundary registry-system
// @def.doc registry-system

import { createHash } from 'node:crypto';
import { Controller, Get, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { computeCatalogDigest, shortDigest, type Catalog } from '@qa-sdk/core';
import type { CatalogStore } from './stores/catalog-store.js';
import type { ConfigStore } from './stores/config-store.js';
import { CATALOG_STORE, CONFIG_STORE } from './modules/catalog/catalog.service.js';

@Controller()
export class HealthController {
  constructor(
    @Optional() @Inject(CATALOG_STORE) private readonly catalogStore?: CatalogStore,
    @Optional() @Inject(CONFIG_STORE) private readonly configStore?: ConfigStore,
  ) {}

  @Get('health')
  health() {
    return { ok: true, service: 'registry-service' };
  }

  @Get('health/live')
  live() {
    return { ok: true };
  }

  @Get('health/generation')
  async generation() {
    if (!this.catalogStore) {
      throw new HttpException(
        { error: 'catalogStore not available' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const catalogs = await this.catalogStore.list();
    const generations: Record<
      string,
      {
        /** shortDigest(catalogDigest) — SDK GENERATION(`catalogId:<12 hex>`)과 같은 알고리즘. 파싱 실패 시 null */
        catalogHash: string | null;
        /** computeCatalogDigest 전체 값 (`sha256:<64 hex>`) */
        catalogDigest: string | null;
        dkgConfigHash: string | null;
        prefixCount: number;
        axisCount: number;
        updatedAt: string;
      }
    > = {};

    for (const catalog of catalogs) {
      const dkgConfigRecord = await this.configStore?.get(catalog.id, 'dkg-config');
      const dkgConfigHash = dkgConfigRecord?.data
        ? createHash('sha256').update(dkgConfigRecord.data).digest('hex').slice(0, 12)
        : null;

      let prefixCount = 0;
      let axisCount = 0;
      let catalogDigest: string | null = null;
      try {
        const parsed = JSON.parse(catalog.data) as Catalog;
        prefixCount = Object.keys(parsed.prefixes ?? {}).length;
        axisCount = Object.keys(parsed.axes ?? {}).length;
        catalogDigest = await computeCatalogDigest(parsed);
      } catch {
        // 파싱·digest 실패는 그대로 드러낸다 — 원문 해시로 대체하지 않는다 (알고리즘이 달라 비교 불가)
        prefixCount = 0;
        axisCount = 0;
      }
      const catalogHash = catalogDigest ? shortDigest(catalogDigest) : null;

      generations[catalog.id] = {
        catalogHash,
        catalogDigest,
        dkgConfigHash,
        prefixCount,
        axisCount,
        updatedAt: catalog.updatedAt,
      };
    }

    return { service: 'registry-service', generations };
  }
}
