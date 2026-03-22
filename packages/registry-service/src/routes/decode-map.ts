/**
 * /api/decode-map — Catalog에서 DecodeMap 생성하여 decode-service에 공급.
 *
 * DecodeMap = prefix의 각 dim에 대해 shape + entries를 포함하는 디코딩 번들.
 * decode-service가 startup 시 이 API를 호출하여 디코더를 로드한다.
 */

import { Hono } from "hono";
import type { CatalogStore } from "../stores/catalog-store.js";

interface DecodeMapDim {
  dimId: string;
  snapshotId: string;
  kind: string | { type: string; indexId?: string };
  entries: string[];
}

interface DecodeMap {
  indexId: string;
  versionId: string;
  shape: number[];
  size: number;
  dims: DecodeMapDim[];
}

export interface DecodeMapRouteDeps {
  catalogStore: CatalogStore;
}

export function createDecodeMapRoutes(deps: DecodeMapRouteDeps) {
  const routes = new Hono();
  const { catalogStore } = deps;

  // GET /api/decode-map — 전체 prefix에 대한 DecodeMap 목록
  routes.get("/api/decode-map", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const record = await catalogStore.get(catalogId);
    if (!record) return c.json({ error: `Catalog '${catalogId}' not found` }, 404);

    const catalog = JSON.parse(record.data);
    const maps: DecodeMap[] = [];

    for (const [prefixId, prefix] of Object.entries(catalog.prefixes ?? {})) {
      const p = prefix as any;
      const versions = p.versions ?? [];
      for (const ver of versions) {
        const map = buildDecodeMap(catalog, prefixId, p, ver.version);
        if (map) maps.push(map);
      }
    }

    return c.json(maps);
  });

  // GET /api/decode-map/:prefix/:version — 단건 DecodeMap
  routes.get("/api/decode-map/:prefix/:version", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const prefixId = c.req.param("prefix");
    const versionId = c.req.param("version");

    const record = await catalogStore.get(catalogId);
    if (!record) return c.json({ error: `Catalog '${catalogId}' not found` }, 404);

    const catalog = JSON.parse(record.data);
    const prefix = catalog.prefixes?.[prefixId];
    if (!prefix) return c.json({ error: `Prefix '${prefixId}' not found` }, 404);

    const map = buildDecodeMap(catalog, prefixId, prefix, versionId);
    if (!map) return c.json({ error: `Version '${versionId}' not found for prefix '${prefixId}'` }, 404);

    return c.json(map);
  });

  return routes;
}

/** catalog prefix 정의에서 DecodeMap 생성 */
function buildDecodeMap(catalog: any, prefixId: string, prefix: any, versionId: string): DecodeMap | null {
  const labels: string[] = prefix.labels ?? [];
  const dims = prefix.dims ?? {};
  const verDef = (prefix.versions ?? []).find((v: any) => v.version === versionId);
  if (!verDef) return null;

  const axisVersions = verDef.axisVersions ?? {};
  const mapDims: DecodeMapDim[] = [];
  const shape: number[] = [];

  for (const label of labels) {
    const dimDef = dims[label];
    if (!dimDef) continue;

    if (dimDef.kind === "axis") {
      const axisId = dimDef.axisId;
      const axis = catalog.axes?.[axisId];
      if (!axis) continue;

      const axisVer = axisVersions[label] ?? Object.keys(axis.versions)[0] ?? "v1";
      const axisVerDef = axis.versions?.[axisVer];
      if (!axisVerDef) continue;

      const entries: string[] = [...axisVerDef.entries];
      mapDims.push({
        dimId: label,
        snapshotId: `${axisId}_${axisVer}`,
        kind: "string_enum",
        entries,
      });
      shape.push(axisVerDef.capacity ?? entries.length);
    } else if (dimDef.kind === "prefix_ref") {
      // prefix_ref — 참조 대상 prefix의 주소 공간 크기를 entries로 표현
      const refPrefixId = dimDef.prefixId;
      const refPrefix = catalog.prefixes?.[refPrefixId];
      if (!refPrefix) continue;

      // 참조 prefix의 최신 버전에서 size 계산
      const refVer = (refPrefix.versions ?? [])[0];
      const refSize = refVer ? computePrefixSize(catalog, refPrefix, refVer.version) : 0;

      mapDims.push({
        dimId: label,
        snapshotId: `ref_${refPrefixId}`,
        kind: { type: "index_ref", indexId: refPrefixId },
        entries: Array.from({ length: refSize }, (_, i) => String(i)),
      });
      shape.push(refSize || 1);
    } else if (dimDef.kind === "table_ref") {
      // table_ref — 스킵 (디코딩에서는 불필요)
      mapDims.push({
        dimId: label,
        snapshotId: `table_${dimDef.tableId}`,
        kind: "string_enum",
        entries: ["_ref"],
      });
      shape.push(1);
    }
  }

  const size = shape.reduce((a, b) => a * b, 1);

  return { indexId: prefixId, versionId, shape, size, dims: mapDims };
}

/** prefix의 전체 주소 공간 크기 계산 */
function computePrefixSize(catalog: any, prefix: any, versionId: string): number {
  const labels: string[] = prefix.labels ?? [];
  const dims = prefix.dims ?? {};
  const verDef = (prefix.versions ?? []).find((v: any) => v.version === versionId);
  if (!verDef) return 0;

  const axisVersions = verDef.axisVersions ?? {};
  let size = 1;

  for (const label of labels) {
    const dimDef = dims[label];
    if (!dimDef) continue;

    if (dimDef.kind === "axis") {
      const axis = catalog.axes?.[dimDef.axisId];
      if (!axis) continue;
      const axisVer = axisVersions[label] ?? Object.keys(axis.versions)[0] ?? "v1";
      const axisVerDef = axis.versions?.[axisVer];
      size *= axisVerDef?.capacity ?? 1;
    } else if (dimDef.kind === "prefix_ref") {
      const refPrefix = catalog.prefixes?.[dimDef.prefixId];
      if (refPrefix) {
        const refVer = (refPrefix.versions ?? [])[0];
        size *= refVer ? computePrefixSize(catalog, refPrefix, refVer.version) : 1;
      }
    }
  }

  return size;
}
