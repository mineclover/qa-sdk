import type { AddressRangeCache, RangeCacheRecord } from "../address-range-cache.js";

export class InMemoryAddressRangeCache implements AddressRangeCache {
  private readonly _store = new Map<string, RangeCacheRecord>();

  private _key(prefix: string, versionId: string, label: string): string {
    return `${prefix}\0${versionId}\0${label}`;
  }

  private _prefixKey(prefix: string, versionId: string): string {
    return `${prefix}\0${versionId}\0`;
  }

  async save(record: RangeCacheRecord): Promise<void> {
    this._store.set(this._key(record.prefix, record.versionId, record.label), record);
  }

  async get(prefix: string, versionId: string, label: string): Promise<RangeCacheRecord | null> {
    return this._store.get(this._key(prefix, versionId, label)) ?? null;
  }

  async list(prefix: string, versionId: string): Promise<RangeCacheRecord[]> {
    const pk = this._prefixKey(prefix, versionId);
    const result: RangeCacheRecord[] = [];
    for (const [key, record] of this._store) {
      if (key.startsWith(pk)) result.push(record);
    }
    return result;
  }

  async delete(prefix: string, versionId: string, label: string): Promise<void> {
    this._store.delete(this._key(prefix, versionId, label));
  }

  async deleteAll(prefix: string, versionId: string): Promise<void> {
    const pk = this._prefixKey(prefix, versionId);
    for (const key of this._store.keys()) {
      if (key.startsWith(pk)) this._store.delete(key);
    }
  }
}
