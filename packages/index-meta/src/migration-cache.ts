// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * MigrationCache — L2 불변 마이그레이션 이력 캐시 (PositionEngine)
 *
 * release 시 생성된 마이그레이션 매핑은 변경 불가.
 * → CoalescingCache로 fetch 후 영구 캐싱 (TTL 없음).
 */

import type {
  MigrationStore,
  MigrationMapping,
  MigrationResolveResult,
} from "./migration-store.js";
import { CoalescingCache } from "./coalescing-cache.js";

// ── MigrationCache ───────────────────────────────────────

export class MigrationCache {
  /** 버전 쌍 → 매핑 목록 (불변) */
  private readonly _pairCache = new CoalescingCache<MigrationMapping[]>();
  /** position 이력 캐시 */
  private readonly _historyCache = new CoalescingCache<MigrationMapping[]>();
  private readonly _store: MigrationStore;

  constructor(store: MigrationStore) {
    this._store = store;
  }

  /** position의 변경 이력 조회 (캐시 우선). */
  async getHistory(prefix: string, position: number): Promise<MigrationMapping[]> {
    return this._historyCache.get(
      `${prefix}\0history\0${position}`,
      () => this._store.getHistory(prefix, position),
    );
  }

  /** 버전 간 전체 변경 조회 (캐시 우선). */
  async getMappings(
    prefix: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<MigrationMapping[]> {
    return this._pairCache.get(
      `${prefix}\0${fromVersionId}\0${toVersionId}`,
      () => this._store.getMappings(prefix, fromVersionId, toVersionId),
    );
  }

  /** position의 현재 상태까지 체이닝 (캐시 우선). */
  async resolveToLatest(
    prefix: string,
    fromVersionId: string,
    position: number,
    latestVersionId: string,
  ): Promise<MigrationResolveResult> {
    return this._store.resolveToLatest(prefix, fromVersionId, position, latestVersionId);
  }

  /** 새 매핑 등록 후 관련 캐시 무효화. */
  async saveMappingsAndInvalidate(
    prefix: string,
    mappings: readonly MigrationMapping[],
  ): Promise<void> {
    await this._store.saveMappings(prefix, mappings);

    // 관련 캐시 무효화
    const pairs = new Set<string>();
    const positions = new Set<number>();
    for (const m of mappings) {
      pairs.add(`${prefix}\0${m.fromVersionId}\0${m.toVersionId}`);
      positions.add(m.position);
    }
    for (const pairKey of pairs) this._pairCache.invalidate(pairKey);
    for (const pos of positions) this._historyCache.invalidate(`${prefix}\0history\0${pos}`);
  }

  /** 전체 캐시 초기화. */
  clear(): void {
    this._pairCache.clear();
    this._historyCache.clear();
  }
}
