import { Inject, Injectable, Optional } from "@nestjs/common";
import { AppError } from "@qa-sdk/core";
import type { CatalogRecord, CatalogStore } from "../../stores/catalog-store.js";
import type { ConfigStore } from "../../stores/config-store.js";

export const CATALOG_STORE = "CATALOG_STORE";
export const CONFIG_STORE = "CONFIG_STORE";
export const CATALOG_CHANGE_HANDLER = "CATALOG_CHANGE_HANDLER";

type CatalogPayload = {
  id?: string | null;
  name?: string | null;
  data?: string | null;
};

type ConfigPayload = {
  data?: string | null;
};

type PrefixCatalog = {
  prefixes?: Record<string, { name?: string; labels?: unknown }>;
};

export interface CatalogChangeHandler {
  catalogChanged(catalogId: string): void | Promise<void>;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_STORE) private readonly catalogStore: CatalogStore,
    @Optional() @Inject(CONFIG_STORE) private readonly configStore?: ConfigStore,
    @Optional() @Inject(CATALOG_CHANGE_HANDLER) private readonly changeHandler?: CatalogChangeHandler,
  ) {}

  static fromStores(deps: {
    catalogStore: CatalogStore;
    configStore?: ConfigStore;
    onCatalogChange?: (catalogId: string) => void | Promise<void>;
  }) {
    const handler = deps.onCatalogChange;
    return new CatalogService(
      deps.catalogStore,
      deps.configStore,
      handler
        ? { catalogChanged: (catalogId: string) => handler(catalogId) }
        : undefined,
    );
  }

  async register(input: unknown) {
    const body = this.asCatalogPayload(input);
    if (!body.id || !body.name || !body.data) {
      throw new AppError("INVALID_INPUT", "id, name, data 필수", 400);
    }

    const existing = await this.catalogStore.get(body.id);
    if (existing) {
      throw new AppError("CONFLICT", `Catalog '${body.id}' already exists`, 409);
    }

    const now = new Date().toISOString();
    await this.catalogStore.register({
      id: body.id,
      name: body.name,
      data: body.data,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: body.id,
      name: body.name,
      createdAt: now,
    };
  }

  async list() {
    const list = await this.catalogStore.list();
    return list.map((record) => ({
      id: record.id,
      name: record.name,
      updatedAt: record.updatedAt,
    }));
  }

  async get(id: string) {
    return this.requireCatalog(id);
  }

  async update(id: string, input: unknown) {
    const existing = await this.requireCatalog(id);
    const body = this.asCatalogPayload(input);

    await this.catalogStore.update(
      id,
      body.name ?? existing.name,
      body.data ?? existing.data,
    );

    const updated = await this.requireCatalog(id);
    await this.notifyCatalogChanged(id);
    return updated;
  }

  async remove(id: string) {
    await this.requireCatalog(id);
    await this.catalogStore.delete(id);
    await this.notifyCatalogChanged(id);
    return { ok: true };
  }

  async listPrefixes(id: string) {
    const record = await this.requireCatalog(id);

    try {
      const catalog = JSON.parse(record.data) as PrefixCatalog;
      return Object.entries(catalog.prefixes ?? {}).map(([prefixId, prefix]) => ({
        id: prefixId,
        name: prefix.name,
        dims: Array.isArray(prefix.labels) ? prefix.labels.length : 0,
      }));
    } catch {
      throw new AppError("INTERNAL_ERROR", "카탈로그 데이터 파싱 실패", 500);
    }
  }

  async getConfig(id: string) {
    return this.getConfigByType(
      id,
      "dkg-config",
      `DkgConfig for catalog '${id}' not found`,
    );
  }

  async setConfig(id: string, input: unknown) {
    return this.setConfigByType(
      id,
      "dkg-config",
      input,
      "data (DkgConfig JSON) 필수",
    );
  }

  async getPatternRules(id: string) {
    return this.getConfigByType(
      id,
      "pattern-rules",
      `PatternRules for catalog '${id}' not found`,
    );
  }

  async setPatternRules(id: string, input: unknown) {
    return this.setConfigByType(
      id,
      "pattern-rules",
      input,
      "data (PatternRules JSON) 필수",
    );
  }

  async listConfigs(id: string) {
    const configStore = this.requireConfigStore();
    const records = await configStore.list(id);
    return records.map((record) => ({
      configType: record.configType,
      updatedAt: record.updatedAt,
    }));
  }

  private async getConfigByType(id: string, configType: string, notFoundMessage: string) {
    const configStore = this.requireConfigStore();
    const record = await configStore.get(id, configType);
    if (!record) {
      throw new AppError("NOT_FOUND", notFoundMessage, 404);
    }

    return {
      catalogId: id,
      data: record.data,
    };
  }

  private async setConfigByType(
    id: string,
    configType: string,
    input: unknown,
    missingDataMessage: string,
  ) {
    await this.requireCatalog(id);

    const configStore = this.requireConfigStore();
    const body = this.asConfigPayload(input);
    if (!body.data) {
      throw new AppError("INVALID_INPUT", missingDataMessage, 400);
    }

    await configStore.set(id, configType, body.data);
    return {
      catalogId: id,
      ok: true,
    };
  }

  private async requireCatalog(id: string): Promise<CatalogRecord> {
    const record = await this.catalogStore.get(id);
    if (!record) {
      throw new AppError("NOT_FOUND", `Catalog '${id}' not found`, 404);
    }

    return record;
  }

  private requireConfigStore(): ConfigStore {
    if (!this.configStore) {
      throw new AppError("SERVICE_UNAVAILABLE", "configStore not available", 503);
    }

    return this.configStore;
  }

  private async notifyCatalogChanged(catalogId: string) {
    await this.changeHandler?.catalogChanged(catalogId);
  }

  private asCatalogPayload(input: unknown): CatalogPayload {
    return this.asRecord(input) as CatalogPayload;
  }

  private asConfigPayload(input: unknown): ConfigPayload {
    return this.asRecord(input) as ConfigPayload;
  }

  private asRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== "object") {
      return {};
    }

    return input as Record<string, unknown>;
  }
}
