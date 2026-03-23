/**
 * worker.ts — decode-service Cloudflare Workers 진입점.
 *
 * DecodeMap 로드 전략:
 *   1. REGISTRY_DB (D1 바인딩) — registry D1에서 catalog 직접 조회 (가장 빠름)
 *   2. REGISTRY_URL — HTTP fetch (fallback, CF Workers 간 fetch 이슈 가능)
 */
import { createApp } from "./app.js";
import { DecoderPool } from "./lib/decoder-pool.js";

interface Env {
  REGISTRY_URL?: string;
  REGISTRY_DB?: any; // D1Database binding (registry의 catalogs 테이블)
}

const pool = new DecoderPool(0);
let loadPromise: Promise<void> | null = null;
let loadError: string | null = null;
let loadStats = { fetched: 0, loaded: 0, errors: [] as string[], source: "" };

async function ensureLoaded(env: Env) {
  if (pool.size > 0) return;
  if (loadPromise) {
    await loadPromise;
    if (pool.size === 0) loadPromise = null;
    if (pool.size > 0) return;
  }
  loadPromise = env.REGISTRY_DB ? loadFromD1(env.REGISTRY_DB) : loadFromHttp(env.REGISTRY_URL);
  return loadPromise;
}

/** D1에서 직접 catalog 조회 → DecodeMap 구성 */
async function loadFromD1(db: any) {
  loadStats.source = "d1";
  try {
    const row = await db.prepare("SELECT data FROM catalogs WHERE id = ?").bind("demo").first();
    if (!row?.data) { loadError = "catalog 'demo' not found in D1"; return; }

    const catalog = JSON.parse(row.data as string);
    const maps = buildDecodeMaps(catalog);
    loadStats.fetched = maps.length;
    for (const map of maps) {
      try { pool.loadMap(map); loadStats.loaded++; }
      catch (e) { loadStats.errors.push(`${map.indexId}: ${e}`); }
    }
  } catch (e) { loadError = `D1: ${e}`; }
}

/** HTTP fetch fallback */
async function loadFromHttp(registryUrl?: string) {
  if (!registryUrl) return;
  loadStats.source = "http";
  try {
    const res = await fetch(`${registryUrl}/api/decode-map`);
    if (!res.ok) { loadError = `fetch ${res.status}`; return; }
    const maps: any[] = await res.json();
    loadStats.fetched = maps.length;
    for (const map of maps) {
      try { pool.loadMap(map); loadStats.loaded++; }
      catch (e) { loadStats.errors.push(`${map.indexId}: ${e}`); }
    }
  } catch (e) { loadError = `HTTP: ${e}`; }
}

/** catalog → DecodeMap[] (axis dim만, prefix_ref/table_ref는 capacity만) */
function buildDecodeMaps(catalog: any): any[] {
  const maps: any[] = [];
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes ?? {})) {
    const p = prefix as any;
    for (const ver of p.versions ?? []) {
      const dims: any[] = [];
      const shape: number[] = [];
      const axisVersions = ver.axisVersions ?? {};

      for (const label of p.labels ?? []) {
        const dimDef = p.dims?.[label];
        if (!dimDef) continue;

        if (dimDef.kind === "axis") {
          const axis = catalog.axes?.[dimDef.axisId];
          if (!axis) continue;
          const axisVer = axisVersions[label] ?? Object.keys(axis.versions)[0] ?? "v1";
          const axisVerDef = axis.versions?.[axisVer];
          if (!axisVerDef) continue;
          const entries = [...axisVerDef.entries];
          dims.push({
            dimId: label,
            snapshotId: `${dimDef.axisId}_${axisVer}`,
            kind: { type: "string_enum" },
            entries,
          });
          shape.push(entries.length);
        } else if (dimDef.kind === "prefix_ref") {
          // prefix_ref: refEntries의 values 크기로 shape 결정
          const refEntries = ver.refEntries?.[label];
          const refValues: number[] = refEntries?.values ? [...refEntries.values] : [];
          const refSize = refValues.length || 1;
          dims.push({
            dimId: label,
            snapshotId: `ref_${dimDef.prefixId}`,
            kind: { type: "index_ref", indexId: dimDef.prefixId },
            entries: refValues.map((v: number) => String(v)),
          });
          shape.push(refSize);
        } else if (dimDef.kind === "table_ref") {
          dims.push({ dimId: label, snapshotId: `table_${dimDef.tableId}`, kind: { type: "string_enum" }, entries: ["_ref"] });
          shape.push(1);
        }
      }

      if (dims.length > 0) {
        maps.push({
          indexId: prefixId,
          versionId: ver.version,
          shape,
          size: shape.reduce((a: number, b: number) => a * b, 1),
          dims,
        });
      }
    }
  }
  return maps;
}

const app = createApp({ pool });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await ensureLoaded(env);

    const url = new URL(request.url);
    if (url.pathname === "/debug") {
      return new Response(JSON.stringify({
        poolSize: pool.size,
        keys: pool.keys().slice(0, 20),
        loadError,
        loadStats,
      }), { headers: { "content-type": "application/json" } });
    }

    return app.fetch(request);
  },
};
