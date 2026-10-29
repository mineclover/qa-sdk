// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  AppError,
  buildCatalogSnapshot,
  findUnversionedBreakingChanges,
  type Catalog,
  type CatalogSnapshot,
  type SnapshotLayoutIssue,
} from '@qa-sdk/core';
import type { CatalogRecord, CatalogStore } from '../../stores/catalog-store.js';
import type { CatalogSnapshotStore } from '../../stores/catalog-snapshot-store.js';
import type { ConfigStore } from '../../stores/config-store.js';

export const CATALOG_STORE = 'CATALOG_STORE';
export const CONFIG_STORE = 'CONFIG_STORE';
export const CATALOG_CHANGE_HANDLER = 'CATALOG_CHANGE_HANDLER';
export const CATALOG_SNAPSHOT_STORE = 'CATALOG_SNAPSHOT_STORE';

/** 다음 snapshot 후보 — 발행 전 판정 결과 */
interface SnapshotCandidate {
  readonly snapshot: CatalogSnapshot;
  readonly issues: readonly SnapshotLayoutIssue[];
  /** 최신 발행본과 내용이 같아 새 version이 필요 없음 */
  readonly unchanged: boolean;
}

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
    @Optional()
    @Inject(CATALOG_CHANGE_HANDLER)
    private readonly changeHandler?: CatalogChangeHandler,
    @Optional()
    @Inject(CATALOG_SNAPSHOT_STORE)
    private readonly snapshotStore?: CatalogSnapshotStore,
  ) {}

  static fromStores(deps: {
    catalogStore: CatalogStore;
    configStore?: ConfigStore;
    snapshotStore?: CatalogSnapshotStore;
    onCatalogChange?: (catalogId: string) => void | Promise<void>;
  }) {
    const handler = deps.onCatalogChange;
    return new CatalogService(
      deps.catalogStore,
      deps.configStore,
      handler ? { catalogChanged: (catalogId: string) => handler(catalogId) } : undefined,
      deps.snapshotStore,
    );
  }

  async register(input: unknown) {
    const body = this.asCatalogPayload(input);
    if (!body.id || !body.name || !body.data) {
      throw new AppError('INVALID_INPUT', 'id, name, data 필수', 400);
    }

    const existing = await this.catalogStore.get(body.id);
    if (existing) {
      throw new AppError('CONFLICT', `Catalog '${body.id}' already exists`, 409);
    }

    // catalog 저장 전에 snapshot 판정 — 발행할 수 없는 catalog는 저장하지 않는다
    const candidate = await this.prepareSnapshot(body.id, body.data);

    const now = new Date().toISOString();
    await this.catalogStore.register({
      id: body.id,
      name: body.name,
      data: body.data,
      createdAt: now,
      updatedAt: now,
    });

    const snapshot = await this.publishCandidate(candidate);

    return {
      id: body.id,
      name: body.name,
      createdAt: now,
      ...(snapshot ? { snapshot } : {}),
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
    const nextData = body.data ?? existing.data;
    const candidate = await this.prepareSnapshot(id, nextData);

    await this.catalogStore.update(id, body.name ?? existing.name, nextData);
    await this.publishCandidate(candidate);

    const updated = await this.requireCatalog(id);
    await this.notifyCatalogChanged(id);
    return updated;
  }

  /**
   * 현재 catalog의 최신 snapshot. 발행 기록이 없거나(시드처럼 store에 직접 쓴 catalog)
   * 현재 내용과 다르면 지금 발행한다 — 같은 prefix version의 breaking 변경이면 422.
   */
  async getLatestSnapshot(id: string): Promise<CatalogSnapshot> {
    const store = this.requireSnapshotStore();
    const record = await this.requireCatalog(id);
    // requireSnapshotStore 통과 후이므로 후보는 항상 존재한다
    const candidate = (await this.prepareSnapshot(id, record.data))!;
    if (candidate.unchanged) {
      const latest = await store.latest(id);
      if (latest) return latest;
    }
    await this.publishCandidate(candidate);
    return candidate.snapshot;
  }

  async getSnapshot(id: string, digest: string): Promise<CatalogSnapshot> {
    const snapshot = await this.requireSnapshotStore().get(digest);
    if (!snapshot || snapshot.catalogId !== id) {
      throw new AppError('NOT_FOUND', `snapshot ${digest} not found for catalog '${id}'`, 404, {
        code: 'UnknownCatalogSnapshot',
      });
    }
    return snapshot;
  }

  /** snapshot 후보 생성과 발행 가능 판정 (ADR-010). snapshot store가 없으면 null */
  private async prepareSnapshot(id: string, data: string): Promise<SnapshotCandidate | null> {
    if (!this.snapshotStore) return null;
    let catalog: Catalog;
    try {
      catalog = JSON.parse(data) as Catalog;
    } catch {
      throw new AppError('INVALID_INPUT', 'data는 Catalog JSON이어야 합니다', 400);
    }
    const latest = await this.snapshotStore.latest(id);
    const { snapshot, issues } = await buildCatalogSnapshot(catalog, {
      snapshotVersion: (latest?.snapshotVersion ?? 0) + 1,
      parentDigest: latest?.digest ?? null,
    });
    if (latest && latest.digest === snapshot.digest) {
      return { snapshot: latest, issues, unchanged: true };
    }
    if (latest) {
      const breaking = findUnversionedBreakingChanges(latest, snapshot);
      if (breaking.length > 0) {
        throw new AppError(
          'UNVERSIONED_BREAKING_CHANGE',
          '같은 prefix version 안에서 주소 layout이 바뀌었습니다 — 새 prefix version을 발행하세요',
          422,
          { code: 'MigrationRequired', breaking },
        );
      }
    }
    return { snapshot, issues, unchanged: false };
  }

  private async publishCandidate(candidate: SnapshotCandidate | null) {
    if (!candidate || !this.snapshotStore) return null;
    if (!candidate.unchanged) await this.snapshotStore.publish(candidate.snapshot);
    return {
      digest: candidate.snapshot.digest,
      snapshotVersion: candidate.snapshot.snapshotVersion,
      issues: candidate.issues,
    };
  }

  private requireSnapshotStore(): CatalogSnapshotStore {
    if (!this.snapshotStore) {
      throw new AppError('SERVICE_UNAVAILABLE', 'snapshotStore not available', 503);
    }
    return this.snapshotStore;
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
      throw new AppError('INTERNAL_ERROR', '카탈로그 데이터 파싱 실패', 500);
    }
  }

  async getConfig(id: string) {
    return this.getConfigByType(id, 'dkg-config', `DkgConfig for catalog '${id}' not found`);
  }

  async setConfig(id: string, input: unknown) {
    return this.setConfigByType(id, 'dkg-config', input, 'data (DkgConfig JSON) 필수');
  }

  async getPatternRules(id: string) {
    return this.getConfigByType(id, 'pattern-rules', `PatternRules for catalog '${id}' not found`);
  }

  async setPatternRules(id: string, input: unknown) {
    return this.setConfigByType(id, 'pattern-rules', input, 'data (PatternRules JSON) 필수');
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
      throw new AppError('NOT_FOUND', notFoundMessage, 404);
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
      throw new AppError('INVALID_INPUT', missingDataMessage, 400);
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
      throw new AppError('NOT_FOUND', `Catalog '${id}' not found`, 404);
    }

    return record;
  }

  private requireConfigStore(): ConfigStore {
    if (!this.configStore) {
      throw new AppError('SERVICE_UNAVAILABLE', 'configStore not available', 503);
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
    if (!input || typeof input !== 'object') {
      return {};
    }

    return input as Record<string, unknown>;
  }
}
