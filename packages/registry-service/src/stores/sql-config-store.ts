// @def.boundary registry-system
// @def.doc registry-system

import type { SqlDriver } from 'index-meta-store';
import type { ConfigRecord, ConfigStore } from './config-store.js';

export class SqlConfigStore implements ConfigStore {
  constructor(private readonly driver: SqlDriver) {}

  async get(catalogId: string, configType: string): Promise<ConfigRecord | null> {
    const row = await this.driver.queryOne<Row>(
      'SELECT * FROM config WHERE catalog_id = ? AND config_type = ?',
      [catalogId, configType],
    );
    return row ? toRecord(row) : null;
  }

  async set(catalogId: string, configType: string, data: string): Promise<void> {
    const now = new Date().toISOString();
    await this.driver.execute(
      `INSERT INTO config (catalog_id, config_type, data, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (catalog_id, config_type)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [catalogId, configType, data, now],
    );
  }

  async list(catalogId: string): Promise<ConfigRecord[]> {
    const rows = await this.driver.query<Row>(
      'SELECT * FROM config WHERE catalog_id = ? ORDER BY config_type',
      [catalogId],
    );
    return rows.map(toRecord);
  }

  async delete(catalogId: string, configType: string): Promise<void> {
    await this.driver.execute('DELETE FROM config WHERE catalog_id = ? AND config_type = ?', [
      catalogId,
      configType,
    ]);
  }
}

interface Row extends Record<string, unknown> {
  catalog_id: string;
  config_type: string;
  data: string;
  updated_at: string;
}

function toRecord(row: Row): ConfigRecord {
  return {
    catalogId: row.catalog_id,
    configType: row.config_type,
    data: row.data,
    updatedAt: row.updated_at,
  };
}
