// @def.boundary decode-service-system
// @def.doc decode-service-system

/**
 * registry decode-map 동기화 — catalog가 바뀌었을 때만 DecodeMap을 다시 불러온다.
 *
 * 변경 판정은 registry `/health/generation`의 catalog별 `catalogDigest`(ADR-010)로 한다.
 * digest를 얻지 못하면(구버전 registry, 일시 장애) 판정할 수 없으므로 매번 다시 불러온다.
 * 불러오기에 실패하면 기존 decoder를 그대로 둔다 (fail-open).
 */
import type { DecodeMap } from 'index-meta-workers';
import type { Logger } from 'pino';
import type { DecoderPool } from './decoder-pool.js';

export type DecodeMapSyncResult =
  | { readonly status: 'unchanged'; readonly generation: string }
  | {
      readonly status: 'loaded';
      readonly generation: string | null;
      readonly loaded: number;
      readonly total: number;
    }
  | { readonly status: 'failed'; readonly reason: string };

export interface DecodeMapSyncDeps {
  registryUrl: string;
  pool: Pick<DecoderPool, 'loadMap'>;
  logger: Pick<Logger, 'info' | 'warn'>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface DecodeMapSync {
  sync(): Promise<DecodeMapSyncResult>;
  /** 마지막으로 불러온 generation (digest 묶음). 불러온 적 없으면 undefined */
  readonly generation: string | null | undefined;
}

interface GenerationResponse {
  generations?: Record<string, { catalogDigest?: string | null }>;
}

/** catalog별 digest를 정렬해 하나의 비교 키로 만든다. digest가 하나라도 없으면 null */
function generationKey(body: GenerationResponse): string | null {
  const entries = Object.entries(body.generations ?? {});
  if (entries.length === 0) return null;
  const parts: string[] = [];
  for (const [catalogId, generation] of entries.toSorted(([a], [b]) => a.localeCompare(b))) {
    if (!generation.catalogDigest) return null;
    parts.push(`${catalogId}=${generation.catalogDigest}`);
  }
  return parts.join(',');
}

export function createDecodeMapSync(deps: DecodeMapSyncDeps): DecodeMapSync {
  const fetchFn = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 5_000;
  let generation: string | null | undefined;

  async function readGeneration(): Promise<string | null> {
    try {
      const res = await fetchFn(`${deps.registryUrl}/health/generation`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      return generationKey((await res.json()) as GenerationResponse);
    } catch {
      return null;
    }
  }

  return {
    get generation() {
      return generation;
    },
    async sync() {
      const next = await readGeneration();
      if (next !== null && next === generation) return { status: 'unchanged', generation: next };

      let maps: DecodeMap[];
      try {
        const res = await fetchFn(`${deps.registryUrl}/api/decode-map`, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          deps.logger.warn({ status: res.status }, 'registry decode-map fetch failed');
          return { status: 'failed', reason: `HTTP ${res.status}` };
        }
        maps = (await res.json()) as DecodeMap[];
      } catch (err) {
        deps.logger.warn({ err }, 'registry decode-map fetch failed — 기존 decoder 유지');
        return { status: 'failed', reason: err instanceof Error ? err.message : String(err) };
      }

      let loaded = 0;
      for (const map of maps) {
        try {
          deps.pool.loadMap(map);
          loaded++;
        } catch (err) {
          deps.logger.warn({ indexId: map.indexId, err }, 'decode-map load failed');
        }
      }
      generation = next;
      deps.logger.info(
        { loaded, total: maps.length, generation: next },
        'loaded decode-maps from registry',
      );
      return { status: 'loaded', generation: next, loaded, total: maps.length };
    },
  };
}
