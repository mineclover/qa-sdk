// @def.boundary registry-system
// @def.doc registry-system

import type { SqlDriver } from 'index-meta-store';
import type {
  AxisProfileRecord,
  AxisProfilePatch,
  AxisProfileStore,
} from './axis-profile-store.js';
import { parseJsonColumn } from '../lib/typed-json.js';

export class SqlAxisProfileStore implements AxisProfileStore {
  constructor(private readonly driver: SqlDriver) {}

  async register(record: AxisProfileRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO axis_profile (id, catalog_id, name, current_version, capacity, entry_count, meta_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.catalogId,
        record.name,
        record.currentVersion,
        record.capacity,
        record.entryCount,
        record.meta ? JSON.stringify(record.meta) : null,
        record.updatedAt,
      ],
    );
  }

  async get(id: string, catalogId: string): Promise<AxisProfileRecord | null> {
    const row = await this.driver.queryOne<AxisRow>(
      'SELECT * FROM axis_profile WHERE id = ? AND catalog_id = ?',
      [id, catalogId],
    );
    return row ? toRecord(row) : null;
  }

  async list(catalogId: string): Promise<AxisProfileRecord[]> {
    const rows = await this.driver.query<AxisRow>(
      'SELECT * FROM axis_profile WHERE catalog_id = ? ORDER BY id',
      [catalogId],
    );
    return rows.map(toRecord);
  }

  async patch(id: string, catalogId: string, patch: AxisProfilePatch): Promise<void> {
    const existing = await this.get(id, catalogId);
    if (!existing) throw new Error(`Axis '${id}' not found`);

    const name = patch.name ?? existing.name;
    const capacity = patch.capacity ?? existing.capacity;
    const currentVersion = patch.currentVersion ?? existing.currentVersion;
    const entryCount = patch.entryCount ?? existing.entryCount;
    const meta = patch.meta ? { ...existing.meta, ...patch.meta } : existing.meta;

    await this.driver.execute(
      `UPDATE axis_profile SET name=?, capacity=?, current_version=?, entry_count=?, meta_json=?, updated_at=?
       WHERE id=? AND catalog_id=?`,
      [
        name,
        capacity,
        currentVersion,
        entryCount,
        meta ? JSON.stringify(meta) : null,
        new Date().toISOString(),
        id,
        catalogId,
      ],
    );
  }

  async delete(id: string, catalogId: string): Promise<void> {
    await this.driver.execute('DELETE FROM axis_profile WHERE id = ? AND catalog_id = ?', [
      id,
      catalogId,
    ]);
  }
}

interface AxisRow {
  id: string;
  catalog_id: string;
  name: string;
  current_version: string;
  capacity: number;
  entry_count: number;
  meta_json: string | null;
  updated_at: string;
  [key: string]: unknown;
}

function toRecord(row: AxisRow): AxisProfileRecord {
  return {
    id: row.id,
    catalogId: row.catalog_id,
    name: row.name,
    currentVersion: row.current_version,
    capacity: Number(row.capacity),
    entryCount: Number(row.entry_count),
    meta: parseJsonColumn<Record<string, unknown> | undefined>(row.meta_json, undefined),
    updatedAt: row.updated_at,
  };
}
