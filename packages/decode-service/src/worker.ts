// @def.boundary decode-service-system
// @def.doc decode-service-system

/**
 * worker.ts — decode-service Cloudflare Workers 진입점.
 *
 * DecodeMap 로드 전략:
 *   1. REGISTRY_DB (D1 바인딩) — registry D1에서 catalog 직접 조회 (가장 빠름)
 *   2. REGISTRY_URL — HTTP fetch (fallback, CF Workers 간 fetch 이슈 가능)
 */
import type { Catalog } from '@qa-sdk/core';
import type { DecodeMap, D1Database } from 'index-meta-workers';
import { createApp } from './app.js';
import { buildDecodeMaps } from './lib/build-decode-maps.js';
import { DecoderPool } from './lib/decoder-pool.js';

interface Env {
  REGISTRY_URL?: string;
  REGISTRY_DB?: D1Database; // D1Database binding (registry의 catalogs 테이블)
}

const pool = new DecoderPool(0);
let loadPromise: Promise<void> | null = null;
let loadError: string | null = null;
let loadStats = { fetched: 0, loaded: 0, errors: [] as string[], source: '' };

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
async function loadFromD1(db: D1Database) {
  loadStats.source = 'd1';
  try {
    const row = await db
      .prepare('SELECT data FROM catalogs WHERE id = ?')
      .bind('demo')
      .first<{ data: string }>();
    if (!row?.data) {
      loadError = "catalog 'demo' not found in D1";
      return;
    }

    const catalog = JSON.parse(row.data) as Catalog;
    const { maps, skipped } = await buildDecodeMaps(catalog);
    loadStats.errors.push(...skipped);
    loadStats.fetched = maps.length;
    for (const map of maps) {
      try {
        pool.loadMap(map);
        loadStats.loaded++;
      } catch (e) {
        loadStats.errors.push(`${map.indexId}: ${e}`);
      }
    }
  } catch (e) {
    loadError = `D1: ${e}`;
  }
}

/** HTTP fetch fallback */
async function loadFromHttp(registryUrl?: string) {
  if (!registryUrl) return;
  loadStats.source = 'http';
  try {
    const res = await fetch(`${registryUrl}/api/decode-map`);
    if (!res.ok) {
      loadError = `fetch ${res.status}`;
      return;
    }
    const maps = (await res.json()) as DecodeMap[];
    loadStats.fetched = maps.length;
    for (const map of maps) {
      try {
        pool.loadMap(map);
        loadStats.loaded++;
      } catch (e) {
        loadStats.errors.push(`${map.indexId}: ${e}`);
      }
    }
  } catch (e) {
    loadError = `HTTP: ${e}`;
  }
}

const app = createApp({ pool });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await ensureLoaded(env);

    const url = new URL(request.url);
    if (url.pathname === '/debug') {
      return new Response(
        JSON.stringify({
          poolSize: pool.size,
          keys: pool.keys().slice(0, 20),
          loadError,
          loadStats,
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    return app.fetch(request);
  },
};
