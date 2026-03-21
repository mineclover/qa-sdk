import type { PrefixOwnerRecord } from "../types/index.js";
import type { PrefixOwnerStore, PrefixProfilePatch } from "./prefix-owner-store.js";

export class InMemoryPrefixOwnerStore implements PrefixOwnerStore {
  private readonly _store = new Map<string, PrefixOwnerRecord>();

  async register(record: PrefixOwnerRecord): Promise<void> {
    if (this._store.has(record.prefix)) {
      throw new Error(`Prefix '${record.prefix}' already registered`);
    }
    this._store.set(record.prefix, record);
  }

  async get(prefix: string): Promise<PrefixOwnerRecord | null> {
    return this._store.get(prefix) ?? null;
  }

  async list(): Promise<PrefixOwnerRecord[]> {
    return [...this._store.values()];
  }

  async delete(prefix: string): Promise<void> {
    this._store.delete(prefix);
  }

  async patch(prefix: string, patch: PrefixProfilePatch): Promise<void> {
    const existing = this._store.get(prefix);
    if (!existing) throw new Error(`Prefix '${prefix}' not found`);

    const mergedMeta: Record<string, unknown> | undefined = patch.meta
      ? { ...(existing.meta ?? {}), ...patch.meta }
      : existing.meta ? { ...existing.meta } : undefined;
    if (patch.name && mergedMeta) {
      mergedMeta.name = patch.name;
    }

    this._store.set(prefix, {
      ...existing,
      meta: mergedMeta,
      labels: patch.labels ?? existing.labels,
    });
  }
}
