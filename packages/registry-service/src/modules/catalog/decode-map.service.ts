import { Inject, Injectable } from "@nestjs/common";
import type { Catalog, PrefixDef } from "@qa-sdk/core";
import { CATALOG_STORE, CatalogHttpError } from "./catalog.service.js";
import type { CatalogStore } from "../../stores/catalog-store.js";

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
    const maps: DecodeMap[] = [];

    for (const [prefixId, prefix] of Object.entries(catalog.prefixes ?? {})) {
      const versions = prefix.versions ?? [];
      for (const version of versions) {
        const map = this.buildDecodeMap(catalog, prefixId, prefix, version.version);
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
      throw new CatalogHttpError(404, { error: `Prefix '${prefixId}' not found` });
    }

    const map = this.buildDecodeMap(catalog, prefixId, prefix, versionId);
    if (!map) {
      throw new CatalogHttpError(404, { error: `Version '${versionId}' not found for prefix '${prefixId}'` });
    }

    return map;
  }

  private async requireCatalog(catalogId: string) {
    const record = await this.catalogStore.get(catalogId);
    if (!record) {
      throw new CatalogHttpError(404, { error: `Catalog '${catalogId}' not found` });
    }

    return JSON.parse(record.data) as Catalog;
  }

  private buildDecodeMap(catalog: Catalog, prefixId: string, prefix: PrefixDef, versionId: string): DecodeMap | null {
    const labels = [...prefix.labels];
    const dims = prefix.dims ?? {};
    const versionDef = (prefix.versions ?? []).find((version) => version.version === versionId);
    if (!versionDef) {
      return null;
    }

    const axisVersions = versionDef.axisVersions ?? {};
    const mapDims: DecodeMapDim[] = [];
    const shape: number[] = [];

    for (const label of labels) {
      const dimDef = dims[label];
      if (!dimDef) {
        continue;
      }

      if (dimDef.kind === "axis") {
        const axis = catalog.axes?.[dimDef.axisId];
        if (!axis) {
          continue;
        }

        const axisVersion = axisVersions[label] ?? Object.keys(axis.versions)[0] ?? "v1";
        const axisVersionDef = axis.versions?.[axisVersion];
        if (!axisVersionDef) {
          continue;
        }

        const entries = [...axisVersionDef.entries];
        mapDims.push({
          dimId: label,
          snapshotId: `${dimDef.axisId}_${axisVersion}`,
          kind: { type: "string_enum" },
          entries,
        });
        shape.push(axisVersionDef.capacity ?? entries.length);
        continue;
      }

      if (dimDef.kind === "prefix_ref") {
        const refEntries = versionDef.refEntries?.[label];
        if (!refEntries?.values?.length) {
          mapDims.length = 0;
          break;
        }

        mapDims.push({
          dimId: label,
          snapshotId: `ref_${dimDef.prefixId}`,
          kind: { type: "index_ref", indexId: dimDef.prefixId },
          entries: [...refEntries.values].map(String),
        });
        shape.push(refEntries.values.length);
        continue;
      }

      if (dimDef.kind === "table_ref") {
        mapDims.push({
          dimId: label,
          snapshotId: `table_${dimDef.table}`,
          kind: { type: "string_enum" },
          entries: ["_ref"],
        });
        shape.push(1);
      }
    }

    const size = shape.reduce((acc, value) => acc * value, 1);
    let refLabels: Record<string, { values: number[]; labels: string[] }> | undefined;
    if (versionDef.refEntries && typeof versionDef.refEntries === "object") {
      refLabels = {};
      for (const [dimLabel, ref] of Object.entries(versionDef.refEntries)) {
        const values = ref.values ? [...ref.values] : [];
        const dimDef = dims[dimLabel];
        const refPrefixId = dimDef?.kind === "prefix_ref" ? dimDef.prefixId : undefined;
        const refPrefix = refPrefixId ? catalog.prefixes?.[refPrefixId] : null;
        refLabels[dimLabel] = {
          values,
          labels: values.map((value) => (refPrefix ? `${refPrefix.id}:${value}` : String(value))),
        };
      }
    }

    return { indexId: prefixId, versionId, shape, size, dims: mapDims, ...(refLabels ? { refLabels } : {}) };
  }
}
