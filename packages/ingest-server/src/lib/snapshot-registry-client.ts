// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * registry snapshot 조회 (read-through cache).
 * - digest 조회: 불변이므로 성공 결과를 영구 캐시
 * - latest 조회: catalog별 TTL 캐시
 * - 404는 undefined (판정은 gate가 한다), 그 외 실패는 throw → gate가 degraded로 처리
 */
import type { CatalogSnapshot } from '@qa-sdk/core';

export interface SnapshotRegistryClientOptions {
  registryUrl: string;
  latestTtlMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface SnapshotRegistryClient {
  latest(catalogId: string): Promise<CatalogSnapshot | undefined>;
  byDigest(catalogId: string, digest: string): Promise<CatalogSnapshot | undefined>;
}

const DEFAULT_LATEST_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 5_000;

export function createSnapshotRegistryClient(
  options: SnapshotRegistryClientOptions,
): SnapshotRegistryClient {
  const base = options.registryUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const ttl = options.latestTtlMs ?? DEFAULT_LATEST_TTL_MS;
  const digestCache = new Map<string, CatalogSnapshot>();
  const latestCache = new Map<string, { snapshot: CatalogSnapshot; expiresAt: number }>();

  async function get(path: string): Promise<CatalogSnapshot | undefined> {
    const res = await fetchImpl(`${base}${path}`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`registry snapshot 조회 실패: ${res.status} ${path}`);
    const text = await res.text();
    try {
      return JSON.parse(text) as CatalogSnapshot;
    } catch (err) {
      throw new Error(`registry snapshot 응답이 JSON이 아닙니다: ${path}`, { cause: err });
    }
  }

  return {
    async latest(catalogId) {
      const cached = latestCache.get(catalogId);
      if (cached && cached.expiresAt > now()) return cached.snapshot;
      const snapshot = await get(`/catalogs/${encodeURIComponent(catalogId)}/snapshots/latest`);
      if (snapshot) {
        latestCache.set(catalogId, { snapshot, expiresAt: now() + ttl });
        digestCache.set(snapshot.digest, snapshot);
      }
      return snapshot;
    },
    async byDigest(catalogId, digest) {
      const cached = digestCache.get(digest);
      if (cached) return cached;
      const snapshot = await get(
        `/catalogs/${encodeURIComponent(catalogId)}/snapshots/${encodeURIComponent(digest)}`,
      );
      if (snapshot) digestCache.set(digest, snapshot);
      return snapshot;
    },
  };
}
