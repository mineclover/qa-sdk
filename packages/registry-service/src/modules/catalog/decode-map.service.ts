// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable } from '@nestjs/common';
import type { Catalog, CatalogSnapshotBuildResult, PrefixVersionDef } from '@qa-sdk/core';
import { AppError, buildCatalogSnapshot, layoutToDecodeMap, prefixLayoutKey } from '@qa-sdk/core';
import { createLogger } from '../../lib/logger.js';
import { CATALOG_STORE } from './catalog.service.js';
import type { CatalogStore } from '../../stores/catalog-store.js';

const logger = createLogger('registry-service');

export interface DecodeMapDim {
  dimId: string;
  snapshotId: string;
  kind: string | { type: string; indexId?: string };
  entries: string[];
}

export interface DecodeMap {
  indexId: string;
  versionId: string;
  shape: number[];
  size: number;
  dims: DecodeMapDim[];
  refLabels?: Record<string, { values: number[]; labels: string[] }>;
}

@Injectable()
export class DecodeMapService {
  constructor(@Inject(CATALOG_STORE) private readonly catalogStore: CatalogStore) {}

  async list(catalogId: string) {
    const catalog = await this.requireCatalog(catalogId);
    const built = await this.buildLayouts(catalog);
    const maps: DecodeMap[] = [];

    for (const [prefixId, prefix] of Object.entries(catalog.prefixes ?? {})) {
      for (const versionDef of prefix.versions ?? []) {
        const map = this.buildDecodeMap(catalog, built, prefixId, versionDef);
        if (map) {
          maps.push(map);
        }
      }
    }

    return maps;
  }

  async get(catalogId: string, prefixId: string, versionId: string) {
    const catalog = await this.requireCatalog(catalogId);
    const prefix = catalog.prefixes?.[prefixId];
    if (!prefix) {
      throw new AppError('NOT_FOUND', `Prefix '${prefixId}' not found`, 404);
    }

    const versionDef = (prefix.versions ?? []).find((version) => version.version === versionId);
    const map = versionDef
      ? this.buildDecodeMap(catalog, await this.buildLayouts(catalog), prefixId, versionDef)
      : null;
    if (!map) {
      throw new AppError(
        'NOT_FOUND',
        `Version '${versionId}' not found for prefix '${prefixId}'`,
        404,
      );
    }

    return map;
  }

  private async requireCatalog(catalogId: string) {
    const record = await this.catalogStore.get(catalogId);
    if (!record) {
      throw new AppError('NOT_FOUND', `Catalog '${catalogId}' not found`, 404);
    }

    return JSON.parse(record.data) as Catalog;
  }

  /**
   * DecodeMap은 snapshot layout만 사용한다. 발행 순번(snapshotVersion)은 registry snapshot store가
   * 소유하므로 여기서는 layout 파생용 고정값을 넘긴다.
   */
  private buildLayouts(catalog: Catalog): Promise<CatalogSnapshotBuildResult> {
    return buildCatalogSnapshot(catalog, { snapshotVersion: 1, parentDigest: null });
  }

  /** PrefixLayout(capacity 기준, ADR-010) → DecodeMap. layout이 없으면 이유를 남기고 null */
  private buildDecodeMap(
    catalog: Catalog,
    built: CatalogSnapshotBuildResult,
    prefixId: string,
    versionDef: PrefixVersionDef,
  ): DecodeMap | null {
    const key = prefixLayoutKey(prefixId, versionDef.version);
    const layout = built.snapshot.layouts[key];
    if (!layout) {
      const issue = built.issues.find((i) => i.key === key);
      logger.warn({ key, issue: issue?.message }, 'DecodeMap을 만들 수 없는 prefix version');
      return null;
    }
    if (!layout.safePrecision) {
      logger.warn({ key, totalSpace: layout.totalSpace }, 'number DecodeMap 범위를 넘는 layout');
      return null;
    }

    const map = layoutToDecodeMap(layout);
    const refLabels = this.buildRefLabels(catalog, prefixId, versionDef);
    return {
      indexId: map.indexId,
      versionId: map.versionId,
      shape: [...map.shape],
      size: map.size,
      dims: map.dims.map((dim) => ({ ...dim, entries: [...dim.entries] })),
      ...(refLabels ? { refLabels } : {}),
    };
  }

  /** prefix_ref dim의 참조 값 표시 라벨 (decode 값이 아닌 UI 표시용) */
  private buildRefLabels(
    catalog: Catalog,
    prefixId: string,
    versionDef: PrefixVersionDef,
  ): DecodeMap['refLabels'] {
    if (!versionDef.refEntries) return undefined;
    const dims = catalog.prefixes[prefixId]?.dims ?? {};
    const refLabels: NonNullable<DecodeMap['refLabels']> = {};
    for (const [dimLabel, ref] of Object.entries(versionDef.refEntries)) {
      const values = ref.values ? [...ref.values] : [];
      const dimDef = dims[dimLabel];
      const refPrefix =
        dimDef?.kind === 'prefix_ref' ? catalog.prefixes[dimDef.prefixId] : undefined;
      refLabels[dimLabel] = {
        values,
        labels: values.map((value) => (refPrefix ? `${refPrefix.id}:${value}` : String(value))),
      };
    }
    return refLabels;
  }
}
