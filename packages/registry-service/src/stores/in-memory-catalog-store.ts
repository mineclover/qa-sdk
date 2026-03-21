import type { CatalogRecord, CatalogStore } from "./catalog-store.js";

export class InMemoryCatalogStore implements CatalogStore {
  private readonly _store = new Map<string, CatalogRecord>();

  async register(record: CatalogRecord): Promise<void> {
    if (this._store.has(record.id)) {
      throw new Error(`Catalog '${record.id}' already registered`);
    }
    this._store.set(record.id, record);
  }

  async get(id: string): Promise<CatalogRecord | null> {
    return this._store.get(id) ?? null;
  }

  async list(): Promise<CatalogRecord[]> {
    return [...this._store.values()];
  }

  async update(id: string, name: string, data: string): Promise<void> {
    const existing = this._store.get(id);
    if (!existing) throw new Error(`Catalog '${id}' not found`);
    this._store.set(id, { ...existing, name, data, updatedAt: new Date().toISOString() });
  }

  async delete(id: string): Promise<void> {
    this._store.delete(id);
  }
}
