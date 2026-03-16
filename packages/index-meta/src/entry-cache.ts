/**
 * EntryCache — L1 prefix·version 단위 양방향 entry 캐시 (PositionEngine)
 *
 * CoalescingCache로 파티션(prefix+versionId)을 bulk load한 뒤
 * position ↔ EntityId 양방향 Map으로 O(1) 조회.
 *
 * 갱신 정책: miss → single-flight fetch → 영구 캐싱.
 * 버전 내 바인딩은 불변이므로 TTL/invalidation 불필요.
 */

import type { IndexMetaStore, EntryRecord } from "./index-meta-store.js";
import type { EntityId } from "./types.js";
import { CoalescingCache } from "./coalescing-cache.js";

// ── 내부 타입 ──────────────────────────────────────────────

interface Partition {
  /** position → EntityId */
  readonly byPosition: Map<number, EntityId>;
  /** EntityId(string) → position */
  readonly byValue: Map<string, number>;
  /** 원본 레코드 (position 오름차순) */
  readonly records: EntryRecord[];
}

// ── EntryCache ────────────────────────────────────────────

export class EntryCache {
  private readonly _cache = new CoalescingCache<Partition>();
  private readonly _store: IndexMetaStore;

  constructor(store: IndexMetaStore) {
    this._store = store;
  }

  /** position → EntityId. miss 시 파티션 전체 fetch. */
  async getByPosition(prefix: string, versionId: string, position: number): Promise<EntityId | null> {
    const p = await this.loadPartition(prefix, versionId);
    return p.byPosition.get(position) ?? null;
  }

  /** EntityId → position. miss 시 파티션 전체 fetch. */
  async getByValue(prefix: string, versionId: string, value: EntityId): Promise<number | null> {
    const p = await this.loadPartition(prefix, versionId);
    return p.byValue.get(String(value)) ?? null;
  }

  /** prefix·versionId의 전체 entry 목록 (캐시 우선). */
  async getAll(prefix: string, versionId: string): Promise<EntryRecord[]> {
    const p = await this.loadPartition(prefix, versionId);
    return p.records;
  }

  /** 중복 체크 — 캐시된 파티션에서 O(1). 파티션 미로드 시 false. */
  exists(prefix: string, versionId: string, value: EntityId): boolean {
    const p = this._cache.peek(this.key(prefix, versionId));
    return p ? p.byValue.has(String(value)) : false;
  }

  /** 캐시된 entry 수. 파티션 미로드 시 0. */
  size(prefix: string, versionId: string): number {
    const p = this._cache.peek(this.key(prefix, versionId));
    return p ? p.byPosition.size : 0;
  }

  /**
   * 파티션에 entry 추가 (append).
   * DB에 이미 저장된 후 캐시를 동기화하는 용도.
   */
  append(prefix: string, versionId: string, record: EntryRecord): void {
    const k = this.key(prefix, versionId);
    const existing = this._cache.peek(k);
    if (!existing) return; // 파티션 미로드 — 다음 접근 시 bulk load
    existing.byPosition.set(record.position, record.value);
    existing.byValue.set(String(record.value), record.position);
    existing.records.push(record);
  }

  /** 파티션 캐시 제거. 다음 접근 시 재로드. */
  invalidate(prefix: string, versionId: string): void {
    this._cache.invalidate(this.key(prefix, versionId));
  }

  /** 전체 캐시 초기화. */
  clear(): void {
    this._cache.clear();
  }

  /** 캐시된 파티션 수. */
  get partitionCount(): number {
    return this._cache.size;
  }

  // ── 내부 ─────────────────────────────────────────────────

  private key(prefix: string, versionId: string): string {
    return `${prefix}\0${versionId}`;
  }

  private loadPartition(prefix: string, versionId: string): Promise<Partition> {
    return this._cache.get(this.key(prefix, versionId), async () => {
      const records = await this._store.getEntries(prefix, versionId);
      return this.buildPartition(records);
    });
  }

  private buildPartition(records: EntryRecord[]): Partition {
    const byPosition = new Map<number, EntityId>();
    const byValue = new Map<string, number>();
    for (const r of records) {
      byPosition.set(r.position, r.value);
      byValue.set(String(r.value), r.position);
    }
    return { byPosition, byValue, records: [...records] };
  }
}
