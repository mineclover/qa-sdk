// @def.boundary index-meta-system
// @def.doc index-meta-system

import type { EntryFlagStore, EntryFlagRecord } from "../entry-flag-store.js";

export class InMemoryEntryFlagStore implements EntryFlagStore {
  // Store all records (append-only), key = "prefix:versionId:position"
  // For current state, we keep ALL records and find the latest by updatedAt
  private readonly _records: EntryFlagRecord[] = [];

  async setFlag(record: EntryFlagRecord): Promise<void> {
    this._records.push(record);
  }

  async getFlag(prefix: string, versionId: string, position: number): Promise<EntryFlagRecord | null> {
    const matches = this._records
      .filter((r) => r.prefix === prefix && r.versionId === versionId && r.position === position)
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return matches[0] ?? null;
  }

  async getFlags(prefix: string, versionId: string): Promise<EntryFlagRecord[]> {
    // Return latest flag per position
    const byPosition = new Map<number, EntryFlagRecord>();
    for (const r of this._records) {
      if (r.prefix !== prefix || r.versionId !== versionId) continue;
      const existing = byPosition.get(r.position);
      if (!existing || r.updatedAt > existing.updatedAt) {
        byPosition.set(r.position, r);
      }
    }
    return [...byPosition.values()].toSorted((a, b) => a.position - b.position);
  }

  async getInactivePositions(prefix: string, versionId: string): Promise<number[]> {
    const flags = await this.getFlags(prefix, versionId);
    return flags
      .filter((f) => f.status === "inactive")
      .map((f) => f.position);
  }
}
