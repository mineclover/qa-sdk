/**
 * permission-view-cache.ts — PermissionView 캐시 매니저
 *
 * ── 이론 ──────────────────────────────────────────────────────────────────
 *
 * 읽기 경로 (초당 수천 회):
 *   요청 → cache.get(userId) → hit → view.check() → O(1)
 *                              miss → loadMask() → createView() → 캐시 → O(1)
 *
 * 쓰기 경로 (분당 수 회):
 *   grant/revoke → DB → cache.patch(userId, "grant", coords)
 *                     → view.applyGrant() → O(1) Set.add (재생성 없음)
 *
 * ── 무효화 수준 ───────────────────────────────────────────────────────────
 *
 *   Level 0: 점진적 패치    — grant/revoke 1건 → Set.add/delete O(1)
 *   Level 1: 키 무효화      — invalidate(userId) → 다음 get에서 재로드
 *   Level 2: 차원 무효화    — invalidateByDim("service", idx) → 해당 service 가진 view 폐기
 *   Level 3: 전체 무효화    — invalidateAll() → schema 변경 시
 *
 * ── Singleflight ──────────────────────────────────────────────────────────
 *
 *   동시 get(same key) N개 → loadMask 1회만 실행, Promise 공유
 */

import type { PermissionCodec } from "./permission-codec.js";
import { PermissionView } from "./permission-codec.js";

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ViewCacheOptions {
  codec: PermissionCodec;
  /** cache miss 시 mask 로딩 함수. */
  loadMask: (key: string) => Promise<Uint8Array>;
  /** 최대 캐시 크기. 초과 시 LRU 제거. 기본 1000. */
  maxSize?: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  patches: number;
  invalidations: number;
  hitRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LRU 항목
// ═══════════════════════════════════════════════════════════════════════════

interface CacheEntry {
  view: PermissionView;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PermissionViewCache
// ═══════════════════════════════════════════════════════════════════════════

export class PermissionViewCache {
  private readonly _codec: PermissionCodec;
  private readonly _loadMask: (key: string) => Promise<Uint8Array>;
  private readonly _maxSize: number;

  private readonly _cache = new Map<string, CacheEntry>();
  /** singleflight: 동시 loadMask 방지 */
  private readonly _inflight = new Map<string, Promise<PermissionView>>();

  private _hits = 0;
  private _misses = 0;
  private _patches = 0;
  private _invalidations = 0;

  constructor(opts: ViewCacheOptions) {
    this._codec = opts.codec;
    this._loadMask = opts.loadMask;
    this._maxSize = opts.maxSize ?? 1000;
  }

  // ── 읽기 ──────────────────────────────────────────────────────────

  /**
   * 캐시된 PermissionView 조회. miss 시 loadMask → createView.
   * Singleflight: 동일 key 동시 요청 시 loadMask 1회만 실행.
   */
  async get(key: string): Promise<PermissionView> {
    const entry = this._cache.get(key);
    if (entry) {
      // LRU 갱신: 삭제 후 재삽입 → Map 순서상 가장 최근으로 이동
      this._cache.delete(key);
      this._cache.set(key, entry);
      this._hits++;
      return entry.view;
    }

    // singleflight: 이미 로딩 중이면 같은 Promise 공유
    const inflight = this._inflight.get(key);
    if (inflight) {
      this._hits++; // inflight도 논리적 hit
      return inflight;
    }

    this._misses++;
    const promise = this._load(key);
    this._inflight.set(key, promise);

    try {
      const view = await promise;
      return view;
    } finally {
      this._inflight.delete(key);
    }
  }

  /**
   * 캐시에 있으면 즉시 반환, 없으면 undefined.
   * 비동기 로드 없이 동기적으로 확인.
   */
  peek(key: string): PermissionView | undefined {
    const entry = this._cache.get(key);
    if (entry) {
      this._hits++;
      return entry.view;
    }
    return undefined;
  }

  // ── 점진적 패치 (Level 0) ─────────────────────────────────────────

  /**
   * 캐시된 view에 권한 1건 부여. 재생성 없이 O(1).
   * @returns 캐시에 해당 key가 있으면 true.
   */
  applyGrant(
    key: string,
    service: string, type: string, resource: string, action: string,
  ): boolean {
    const entry = this._cache.get(key);
    if (!entry) return false;
    entry.view.applyGrant(service, type, resource, action);
    this._patches++;
    return true;
  }

  /**
   * 캐시된 view에서 권한 1건 회수. 재생성 없이 O(1).
   * @returns 캐시에 해당 key가 있으면 true.
   */
  applyRevoke(
    key: string,
    service: string, type: string, resource: string, action: string,
  ): boolean {
    const entry = this._cache.get(key);
    if (!entry) return false;
    entry.view.applyRevoke(service, type, resource, action);
    this._patches++;
    return true;
  }

  // ── 무효화 ────────────────────────────────────────────────────────

  /** Level 1: 특정 키 무효화. 다음 get()에서 loadMask 재호출. */
  invalidate(key: string): boolean {
    const deleted = this._cache.delete(key);
    if (deleted) this._invalidations++;
    return deleted;
  }

  /** Level 3: 전체 무효화. schema 변경 시. */
  invalidateAll(): number {
    const count = this._cache.size;
    this._cache.clear();
    this._invalidations += count;
    return count;
  }

  /**
   * Level 2: 차원 기반 무효화.
   * 해당 차원 값을 가진 권한이 있는 모든 캐시 view를 폐기.
   *
   * @param dimLabel 차원 이름 ("service", "type", "resource", "action")
   * @param value 차원 값 (라벨 문자열)
   * @returns 무효화된 key 목록
   *
   * @example
   * // "admin/teams" 리소스가 삭제됨 → 해당 리소스 권한 가진 뷰 무효화
   * cache.invalidateByDim("resource", "admin/teams");
   */
  invalidateByDim(
    dimLabel: "service" | "type" | "resource" | "action",
    value: string,
  ): string[] {
    const dimIndex = ["service", "type", "resource", "action"].indexOf(dimLabel);
    if (dimIndex < 0) return [];

    let valueIdx: number;
    try {
      valueIdx = this._codec["_getLabelIndex"](
        dimLabel as "service" | "type" | "resource" | "action",
        value,
      );
    } catch {
      return []; // 알 수 없는 값이면 무효화 대상 없음
    }

    const invalidated: string[] = [];
    for (const [key, entry] of this._cache) {
      const distinct = entry.view.bitSet.distinctDim(dimIndex);
      if (distinct.includes(valueIdx)) {
        this._cache.delete(key);
        invalidated.push(key);
        this._invalidations++;
      }
    }
    return invalidated;
  }

  // ── 통계 ──────────────────────────────────────────────────────────

  get size(): number { return this._cache.size; }

  get stats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      size: this._cache.size,
      hits: this._hits,
      misses: this._misses,
      patches: this._patches,
      invalidations: this._invalidations,
      hitRate: total > 0 ? this._hits / total : 0,
    };
  }

  resetStats(): void {
    this._hits = 0;
    this._misses = 0;
    this._patches = 0;
    this._invalidations = 0;
  }

  // ── 내부 ──────────────────────────────────────────────────────────

  private async _load(key: string): Promise<PermissionView> {
    const mask = await this._loadMask(key);
    const view = this._codec.createView(mask);
    this._evictIfNeeded();
    this._cache.set(key, { view });
    return view;
  }

  /** LRU: maxSize 초과 시 Map 삽입 순서상 가장 오래된 항목 제거 */
  private _evictIfNeeded(): void {
    if (this._cache.size < this._maxSize) return;
    // Map.keys().next() → 가장 먼저 삽입된 키 (LRU)
    const oldest = this._cache.keys().next().value;
    if (oldest !== undefined) this._cache.delete(oldest);
  }
}
