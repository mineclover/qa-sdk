import type { AxisProfileRecord, AxisProfilePatch, AxisProfileStore } from "./axis-profile-store.js";

export class InMemoryAxisProfileStore implements AxisProfileStore {
  private readonly _store = new Map<string, AxisProfileRecord>();

  private key(id: string, catalogId: string): string {
    return `${catalogId}:${id}`;
  }

  async register(record: AxisProfileRecord): Promise<void> {
    const k = this.key(record.id, record.catalogId);
    if (this._store.has(k)) throw new Error(`Axis '${record.id}' in '${record.catalogId}' already exists`);
    this._store.set(k, record);
  }

  async get(id: string, catalogId: string): Promise<AxisProfileRecord | null> {
    return this._store.get(this.key(id, catalogId)) ?? null;
  }

  async list(catalogId: string): Promise<AxisProfileRecord[]> {
    return [...this._store.values()].filter(r => r.catalogId === catalogId);
  }

  async patch(id: string, catalogId: string, patch: AxisProfilePatch): Promise<void> {
    const k = this.key(id, catalogId);
    const existing = this._store.get(k);
    if (!existing) throw new Error(`Axis '${id}' not found`);
    this._store.set(k, {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
      ...(patch.currentVersion !== undefined ? { currentVersion: patch.currentVersion } : {}),
      ...(patch.entryCount !== undefined ? { entryCount: patch.entryCount } : {}),
      ...(patch.meta !== undefined ? { meta: { ...existing.meta, ...patch.meta } } : {}),
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string, catalogId: string): Promise<void> {
    this._store.delete(this.key(id, catalogId));
  }
}
