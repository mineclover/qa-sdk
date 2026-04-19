// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * MetadataCache — position 기반 메타데이터 캐시 (PositionEngine Phase 4)
 *
 * EntryMetadataStore 위에 CoalescingCache를 올린 캐싱 레이어.
 *
 * ── L1 Entry Cache와의 차이 ─────────────────────────────────────────────────
 *
 * | 속성 | L1 EntryCache | MetadataCache |
 * |------|--------------|---------------|
 * | 불변성 | 불변 (영구 유효) | 가변 (upsert 가능) |
 * | TTL | 없음 | 선택적 (isStale) |
 * | invalidation | 없음 | set/delete 시 invalidate |
 *
 * ── Active 수렴 ─────────────────────────────────────────────────────────────
 *
 * 메타데이터는 버전에 종속되지 않고 position에 직접 연결된다.
 * 어떤 버전의 주소를 가지고 있든, 메타데이터 조회는 항상 같은
 * (prefix, position) 으로 수렴한다.
 */

import type { EntryMetadataStore } from "./entry-metadata-store.js";
import { CoalescingCache } from "./coalescing-cache.js";

// ── 옵션 ────────────────────────────────────────────────────

export interface MetadataCacheOptions {
  /**
   * TTL (밀리초). 지정 시 캐시된 값이 TTL 초과 시 stale 판정.
   * 미지정 시 set/delete에 의한 명시적 invalidation만 적용.
   */
  ttl?: number;
}

// ── MetadataCache ───────────────────────────────────────────

export class MetadataCache {
  private readonly _store: EntryMetadataStore;
  private readonly _ttl: number | undefined;

  /** 단일 키 캐시: "prefix\0position\0key" → value */
  private readonly _single: CoalescingCache<unknown | null>;

  /** getAll 캐시: "prefix\0position" → Record<string, unknown> */
  private readonly _all: CoalescingCache<Record<string, unknown>>;

  constructor(store: EntryMetadataStore, options: MetadataCacheOptions = {}) {
    this._store = store;
    this._ttl = options.ttl;

    const staleFn = this._makeStaleFn();
    this._single = new CoalescingCache<unknown | null>({ isStale: staleFn });
    this._all = new CoalescingCache<Record<string, unknown>>({ isStale: staleFn });
  }

  /** 메타데이터 설정 (upsert). 캐시도 즉시 갱신. */
  async set(prefix: string, position: number, key: string, value: unknown): Promise<void> {
    await this._store.set(prefix, position, key, value);
    this._invalidatePosition(prefix, position);
  }

  /** 단일 메타데이터 조회. 캐시 우선. */
  async get(prefix: string, position: number, key: string): Promise<unknown | null> {
    return this._single.get(
      this._singleKey(prefix, position, key),
      () => this._store.get(prefix, position, key),
    );
  }

  /** position의 모든 메타데이터 조회. 캐시 우선. */
  async getAll(prefix: string, position: number): Promise<Record<string, unknown>> {
    return this._all.get(
      this._allKey(prefix, position),
      () => this._store.getAll(prefix, position),
    );
  }

  /** 메타데이터 삭제. 캐시도 즉시 무효화. */
  async delete(prefix: string, position: number, key: string): Promise<void> {
    await this._store.delete(prefix, position, key);
    this._invalidatePosition(prefix, position);
  }

  /** prefix의 특정 key를 가진 모든 position 조회. (캐시 미적용 — 범위 쿼리) */
  async findByKey(prefix: string, key: string): Promise<Array<{ position: number; value: unknown }>> {
    return this._store.findByKey(prefix, key);
  }

  /** 특정 position의 캐시 무효화. */
  invalidate(prefix: string, position: number): void {
    this._invalidatePosition(prefix, position);
  }

  /** 전체 캐시 초기화. */
  clear(): void {
    this._single.clear();
    this._all.clear();
  }

  /** 캐시된 엔트리 수. */
  get size(): number {
    return this._single.size + this._all.size;
  }

  // ── 내부 ─────────────────────────────────────────────────

  private _singleKey(prefix: string, position: number, key: string): string {
    return `${prefix}\0${position}\0${key}`;
  }

  private _allKey(prefix: string, position: number): string {
    return `${prefix}\0${position}`;
  }

  /** position 관련 모든 캐시 무효화 (single + all). */
  private _invalidatePosition(prefix: string, position: number): void {
    // all 캐시 무효화
    this._all.invalidate(this._allKey(prefix, position));

    // single 캐시에서 해당 position의 모든 키를 찾아 무효화하기 어려우므로
    // single 캐시 전체를 초기화하는 대신, 해당 position의 키를 알 수 없으므로
    // all 캐시만 무효화하고, single은 다음 접근 시 TTL로 갱신된다.
    // 단, TTL이 없는 경우 stale 데이터 위험이 있으므로 single도 정리.
    // CoalescingCache에는 prefix 기반 invalidation이 없으므로
    // 정확한 key를 모르면 전체 clear가 필요하다.
    // → 실용적 선택: single 전체 clear (메타데이터는 소규모이므로 부담 적음)
    this._single.clear();
  }

  private _makeStaleFn(): ((value: unknown, cachedAt: number) => boolean) | undefined {
    const ttl = this._ttl;
    if (ttl === undefined) return undefined;
    return (_value: unknown, cachedAt: number) => Date.now() - cachedAt > ttl;
  }
}
