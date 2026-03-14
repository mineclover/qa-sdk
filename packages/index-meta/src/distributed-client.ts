/**
 * DistributedStoreClient
 *
 * PrefixRouter를 통해 올바른 D1 인스턴스로 요청을 라우팅한다.
 * 호출자는 prefix만 알면 되고, 어느 D1에 있는지는 몰라도 된다.
 *
 * 구조:
 *   PrefixRegistry  — (prefix, versionId) → capacity  (중앙)
 *   PrefixRouter    — prefix → d1DatabaseId            (라우팅)
 *   stores          — d1DatabaseId → IndexMetaStore    (각 D1 인스턴스)
 */

import type { PrefixRegistry } from "./prefix-registry.js";
import type { PrefixRouter } from "./prefix-router.js";
import type { IndexMetaStore, EntryRecord } from "./index-meta-store.js";
import { ValidationError } from "./errors.js";

export class DistributedStoreClient {
  constructor(
    private readonly registry: PrefixRegistry,
    private readonly router: PrefixRouter,
    /** d1DatabaseId → IndexMetaStore 인스턴스 맵 */
    private readonly stores: ReadonlyMap<string, IndexMetaStore>
  ) {}

  // ── 라우팅 ───────────────────────────────────────────────

  private async _store(prefix: string): Promise<IndexMetaStore> {
    const dbId = await this.router.getDatabase(prefix);
    if (!dbId) {
      throw new ValidationError(
        `DistributedStoreClient: no D1 database routed for prefix "${prefix}"`
      );
    }
    const store = this.stores.get(dbId);
    if (!store) {
      throw new ValidationError(
        `DistributedStoreClient: D1 database "${dbId}" not registered in stores`
      );
    }
    return store;
  }

  // ── capacity fast-path (중앙 registry) ───────────────────

  async getCapacity(prefix: string, versionId: string): Promise<number | null> {
    return this.registry.getCapacity(prefix, versionId);
  }

  // ── entry 조회 (D1 라우팅) ───────────────────────────────

  async getEntries(prefix: string, versionId: string): Promise<EntryRecord[]> {
    const store = await this._store(prefix);
    return store.getEntries(prefix, versionId);
  }

  async getEntriesInRange(
    prefix: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    const store = await this._store(prefix);
    return store.getEntriesInRange(prefix, versionId, from, to);
  }

  async getEntry(
    prefix: string,
    versionId: string,
    position: number
  ): Promise<EntryRecord | null> {
    const store = await this._store(prefix);
    return store.getEntry(prefix, versionId, position);
  }

  // ── D1 단위 백업 지원 ────────────────────────────────────

  /**
   * 특정 D1 인스턴스가 담당하는 모든 prefix 목록.
   * 해당 D1의 전체 백업 범위 파악에 사용.
   */
  async listPrefixesByDatabase(d1DatabaseId: string): Promise<string[]> {
    return this.router.listPrefixes(d1DatabaseId);
  }
}
