import type { AddressStateStore, AddressStateCacheRecord } from "../invalid-range-store.js";


export class InMemoryAddressStateStore implements AddressStateStore {
  private readonly _store = new Map<string, AddressStateCacheRecord>();

  async save(record: AddressStateCacheRecord): Promise<void> {
    this._store.set(`${record.prefix}:${record.versionId}`, record);
  }

  async get(prefix: string, versionId: string): Promise<AddressStateCacheRecord | null> {
    return this._store.get(`${prefix}:${versionId}`) ?? null;
  }

  async delete(prefix: string, versionId: string): Promise<void> {
    this._store.delete(`${prefix}:${versionId}`);
  }
}
