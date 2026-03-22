/**
 * worker.ts — decode-service Cloudflare Workers 진입점.
 * Stateless — DecoderPool만 사용. DB 불필요.
 * REGISTRY_URL 환경변수 설정 시 startup에서 DecodeMap 자동 fetch.
 */
import { createApp } from "./app.js";
import { DecoderPool } from "./lib/decoder-pool.js";

interface Env {
  REGISTRY_URL?: string;
  CACHE_TTL_MS?: string;
}

const pool = new DecoderPool(0); // CF Workers: TTL 무한 (매 요청 새 인스턴스 아님)
let loadPromise: Promise<void> | null = null;
let loadError: string | null = null;
let loadStats = { fetched: 0, loaded: 0, errors: [] as string[] };

async function ensureLoaded(registryUrl?: string) {
  if (pool.size > 0 || !registryUrl) return;
  if (loadPromise) {
    await loadPromise;
    // 이전 시도 실패 시 재시도 허용
    if (pool.size === 0) loadPromise = null;
    if (pool.size > 0) return;
  }
  loadPromise = doLoad(registryUrl);
  return loadPromise;
}

async function doLoad(registryUrl: string) {
  const url = `${registryUrl}/api/decode-map`;
  try {
    const res = await fetch(url);
    if (!res.ok) { loadError = `fetch ${res.status} from ${url}`; return; }
    const maps: any[] = await res.json();
    loadStats.fetched = maps.length;
    for (const map of maps) {
      try { pool.loadMap(map); loadStats.loaded++; }
      catch (e) { loadStats.errors.push(`${map.indexId}: ${e}`); }
    }
  } catch (e) { loadError = String(e); }
}

const app = createApp({ pool });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await ensureLoaded(env.REGISTRY_URL);

    // /debug — pool 상태 + 마지막 로드 에러 확인
    const url = new URL(request.url);
    if (url.pathname === "/debug") {
      return new Response(JSON.stringify({
        poolSize: pool.size,
        keys: pool.keys(),
        registryUrl: env.REGISTRY_URL ?? null,
        loadError,
        loadStats,
      }), { headers: { "content-type": "application/json" } });
    }

    return app.fetch(request);
  },
};
