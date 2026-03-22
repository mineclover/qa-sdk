import type { ConfigRecord, ConfigStore } from "./config-store.js";

export class InMemoryConfigStore implements ConfigStore {
  private readonly store = new Map<string, ConfigRecord>();

  private key(catalogId: string, configType: string): string {
    return `${catalogId}:${configType}`;
  }

  async get(catalogId: string, configType: string): Promise<ConfigRecord | null> {
    return this.store.get(this.key(catalogId, configType)) ?? null;
  }

  async set(catalogId: string, configType: string, data: string): Promise<void> {
    this.store.set(this.key(catalogId, configType), {
      catalogId,
      configType,
      data,
      updatedAt: new Date().toISOString(),
    });
  }

  async list(catalogId: string): Promise<ConfigRecord[]> {
    return [...this.store.values()].filter(r => r.catalogId === catalogId);
  }

  async delete(catalogId: string, configType: string): Promise<void> {
    this.store.delete(this.key(catalogId, configType));
  }
}
