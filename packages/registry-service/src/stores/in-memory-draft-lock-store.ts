// @def.boundary registry-system
// @def.doc registry-system

import type { DraftLock } from '../types/index.js';
import type { DraftLockStore } from './draft-lock-store.js';

export class InMemoryDraftLockStore implements DraftLockStore {
  private readonly _locks = new Map<string, DraftLock>();

  private key(prefix: string, versionId: string): string {
    return `${prefix}\0${versionId}`;
  }

  async acquire(lock: DraftLock): Promise<void> {
    this._locks.set(this.key(lock.prefix, lock.versionId), lock);
  }

  async release(prefix: string, versionId: string): Promise<boolean> {
    return this._locks.delete(this.key(prefix, versionId));
  }

  async get(prefix: string, versionId: string): Promise<DraftLock | null> {
    return this._locks.get(this.key(prefix, versionId)) ?? null;
  }

  async isLocked(prefix: string, versionId: string): Promise<boolean> {
    return this._locks.has(this.key(prefix, versionId));
  }

  async listAll(): Promise<DraftLock[]> {
    return [...this._locks.values()];
  }
}
