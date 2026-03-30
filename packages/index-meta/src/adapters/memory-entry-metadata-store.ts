import type { EntryMetadataStore, MetadataEntry } from "../entry-metadata-store.js";

export class InMemoryEntryMetadataStore implements EntryMetadataStore {
  // key = "prefix\0position\0key"
  private readonly _store = new Map<string, MetadataEntry>();

  private pk(prefix: string, position: number, key: string): string {
    return `${prefix}\0${position}\0${key}`;
  }

  async set(prefix: string, position: number, key: string, value: unknown): Promise<void> {
    this._store.set(this.pk(prefix, position, key), {
      position,
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  }

  async get(prefix: string, position: number, key: string): Promise<unknown | null> {
    return this._store.get(this.pk(prefix, position, key))?.value ?? null;
  }

  async getAll(prefix: string, position: number): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    const prefixKey = `${prefix}\0${position}\0`;
    for (const [k, entry] of this._store) {
      if (k.startsWith(prefixKey)) {
        result[entry.key] = entry.value;
      }
    }
    return result;
  }

  async delete(prefix: string, position: number, key: string): Promise<void> {
    this._store.delete(this.pk(prefix, position, key));
  }

  async findByKey(prefix: string, key: string): Promise<Array<{ position: number; value: unknown }>> {
    const result: Array<{ position: number; value: unknown }> = [];
    for (const [k, entry] of this._store) {
      if (k.startsWith(`${prefix}\0`) && entry.key === key) {
        result.push({ position: entry.position, value: entry.value });
      }
    }
    return result.toSorted((a, b) => a.position - b.position);
  }
}
