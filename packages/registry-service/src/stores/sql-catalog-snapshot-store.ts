// @def.boundary registry-system
// @def.doc registry-system

import { canonicalJson, type CatalogSnapshot } from '@qa-sdk/core';
import type { SqlDriver } from 'index-meta-store';
import { checkPublishable, type CatalogSnapshotStore } from './catalog-snapshot-store.js';

type SnapshotRow = { data: string };

export class SqlCatalogSnapshotStore implements CatalogSnapshotStore {
  constructor(private readonly driver: SqlDriver) {}

  async publish(snapshot: CatalogSnapshot): Promise<'created' | 'exists'> {
    const [existing, latest] = await Promise.all([
      this.get(snapshot.digest),
      this.latest(snapshot.catalogId),
    ]);
    if (checkPublishable(snapshot, existing, latest) === 'exists') return 'exists';
    await this.driver.execute(
      `INSERT INTO catalog_snapshots (digest, catalog_id, snapshot_version, data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        snapshot.digest,
        snapshot.catalogId,
        snapshot.snapshotVersion,
        canonicalJson(snapshot),
        new Date().toISOString(),
      ],
    );
    return 'created';
  }

  async get(digest: string): Promise<CatalogSnapshot | undefined> {
    const row = await this.driver.queryOne<SnapshotRow>(
      'SELECT data FROM catalog_snapshots WHERE digest = ?',
      [digest],
    );
    return row ? parseSnapshot(row.data) : undefined;
  }

  async latest(catalogId: string): Promise<CatalogSnapshot | undefined> {
    const row = await this.driver.queryOne<SnapshotRow>(
      'SELECT data FROM catalog_snapshots WHERE catalog_id = ? ORDER BY snapshot_version DESC LIMIT 1',
      [catalogId],
    );
    return row ? parseSnapshot(row.data) : undefined;
  }
}

function parseSnapshot(data: string): CatalogSnapshot {
  // 이 store가 canonicalJson으로 직접 쓴 값만 읽는다
  return JSON.parse(data) as CatalogSnapshot;
}
