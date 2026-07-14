// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * BitmapLruCache — process-local LRU 캐시.
 *
 * spec 04 §3.1 — `BitmapCacheEntry`(grammar #11 key + prefix + prefixVersion +
 *   mask + issuedAt + ttlMs)를 1차 표면으로 한다. setEntry/getEntry/evictByKey
 *   가 신 API.
 *
 * 기존 `set/get(userId, prefix, v, VersionedBitmap)` 호출자 무회귀 보장을 위해
 *   leagcy 별도 `LRUCache<string, VersionedBitmap>`을 병행 보관한다(키 형식
 *   `userId|prefix|v` — grammar #11 키와 충돌하지 않음). subscriber/publisher 의
 *   pub/sub round-trip 시나리오는 legacy 맵 위에서 그대로 동작한다.
 */

import { LRUCache } from 'lru-cache';
import type { VersionedBitmap } from 'permission-engine';
import {
  buildBitmapCacheKey,
  type BitmapCacheKey,
  type VersionTagState,
} from 'sim-identifier-grammar';

/** spec 04 §3.1 — 기본 120000 (2분). */
export const DEFAULT_BITMAP_TTL_MS = 120_000;

/** spec 04 §3.1 — 캐시 entry 형태 (인터페이스 그대로). */
export interface BitmapCacheEntry {
  /** grammar #11 cache key (sim-identifier-grammar `buildBitmapCacheKey`). */
  key: string;
  /** catalog 등록 prefix (grammar #1). */
  prefix: string;
  /** 발급 시점 version axis 값 (grammar #3). */
  prefixVersion: string;
  mask: Uint8Array;
  /** epoch ms. */
  issuedAt: number;
  /** 기본 120000 (2분). */
  ttlMs: number;
}

export interface BitmapLruCacheOptions {
  max: number;
}

/**
 * Deprecated alias — grammar #11 builder 사용을 권장. 기존 호출자(legacy
 * `userId|prefix|v` 키 포맷) 무회귀용. legacy prefix는 3-tier sim.{cat}.{name}
 * 일 때만 grammar #11 합성을 시도하고, 그 외(예: 기존 테스트의 "sim.bitmap" 2-tier)
 * 는 단순 합성 문자열을 반환해 deprecation 경로 유지.
 */
export function makeKey(userId: string, prefix: string, v: string): string {
  const parts = prefix.split('.');
  const versionMatch = v.match(/^v(\d+)(?:-(stable|candidate|retired))?$/);
  if (parts.length === 3 && versionMatch && /^[A-Za-z0-9_-]+$/.test(userId)) {
    try {
      const key: BitmapCacheKey = {
        scope: 'user',
        id: userId,
        prefix: {
          namespace: parts[0] as BitmapCacheKey['prefix']['namespace'],
          category: parts[1] as BitmapCacheKey['prefix']['category'],
          name: parts[2],
        },
        version: {
          axis: 'version',
          value: Number(versionMatch[1]),
          state: (versionMatch[2] as VersionTagState | undefined) ?? 'stable',
        },
      };
      return buildBitmapCacheKey(key);
    } catch {
      // grammar 검증 실패 — legacy 합성으로 fallback.
    }
  }
  return `${userId}|${prefix}|${v}`;
}

export function parseKey(key: string): { userId: string; prefix: string; v: string } {
  const [userId, prefix, v] = key.split('|');
  if (!userId || !prefix || !v) {
    throw new Error(`invalid cache key: ${key}`);
  }
  return { userId, prefix, v };
}

export class BitmapLruCache {
  /** 신 API(spec 04 §3.1) — grammar #11 key → BitmapCacheEntry. */
  private readonly entries: LRUCache<string, BitmapCacheEntry>;
  /** 레거시 호출자(VersionedBitmap) 무회귀용 별도 맵. */
  private readonly legacy: LRUCache<string, VersionedBitmap>;

  constructor(opts: BitmapLruCacheOptions) {
    this.entries = new LRUCache({ max: opts.max, ttlAutopurge: false });
    this.legacy = new LRUCache({ max: opts.max, ttlAutopurge: false });
  }

  // ───── spec 04 §3.1 신 API ─────

  /** spec 04 §3.1 — entry 본문 그대로 LRU에 저장. ttlMs ≤ 0 → 무시. */
  setEntry(e: BitmapCacheEntry): void {
    if (e.ttlMs <= 0) return;
    this.entries.set(e.key, e, { ttl: e.ttlMs });
  }

  getEntry(key: string): BitmapCacheEntry | undefined {
    return this.entries.get(key);
  }

  /** subscriber가 evict trigger로 사용. */
  evictByKey(key: string): boolean {
    return this.entries.delete(key);
  }

  // ───── 레거시 API (VersionedBitmap 호환) ─────

  set(userId: string, prefix: string, v: string, bitmap: VersionedBitmap): void {
    const remaining = new Date(bitmap.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return;
    const k = `${userId}|${prefix}|${v}`;
    this.legacy.set(k, bitmap, { ttl: remaining });
  }

  get(userId: string, prefix: string, v: string): VersionedBitmap | undefined {
    return this.legacy.get(`${userId}|${prefix}|${v}`);
  }

  // ───── invalidation (양 맵 모두 청소) ─────

  /** §5 scope=user — 해당 user의 모든 entry 삭제. */
  invalidateUser(userId: string): number {
    let removed = 0;
    // legacy: `${userId}|...` prefix
    const legacyNeedle = `${userId}|`;
    for (const k of this.legacy.keys()) {
      if (k.startsWith(legacyNeedle)) {
        this.legacy.delete(k);
        removed++;
      }
    }
    // 신 API grammar #11: `bitmap:user:${userId}:`
    const entryNeedle = `bitmap:user:${userId}:`;
    for (const k of this.entries.keys()) {
      if (k.startsWith(entryNeedle)) {
        this.entries.delete(k);
        removed++;
      }
    }
    return removed;
  }

  /** §5 scope=role — affectedUserIds 일괄 삭제. */
  invalidateUsers(userIds: readonly string[]): number {
    let removed = 0;
    for (const id of userIds) removed += this.invalidateUser(id);
    return removed;
  }

  /** §5 scope=prefix — 해당 prefix의 모든 entry 삭제. */
  invalidatePrefix(prefix: string): number {
    let removed = 0;
    const legacyNeedle = `|${prefix}|`;
    for (const k of this.legacy.keys()) {
      if (k.includes(legacyNeedle)) {
        this.legacy.delete(k);
        removed++;
      }
    }
    // 신 API grammar #11: `bitmap:{scope}:{id}:${prefix}:`
    const entryNeedle = `:${prefix}:`;
    for (const k of this.entries.keys()) {
      if (k.includes(entryNeedle)) {
        this.entries.delete(k);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.entries.size + this.legacy.size;
  }

  clear(): void {
    this.entries.clear();
    this.legacy.clear();
  }
}
