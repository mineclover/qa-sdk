import type { SqlDriver } from "index-meta";
import type { CatalogRecord, CatalogStore } from "./catalog-store.js";

export class SqlCatalogStore implements CatalogStore {
  constructor(private readonly driver: SqlDriver) {}

  async register(record: CatalogRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO catalogs (id, name, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [record.id, record.name, record.data, record.createdAt, record.updatedAt],
    );
  }

  async get(id: string): Promise<CatalogRecord | null> {
    const row = await this.driver.queryOne<{
      id: string; name: string; data: string; created_at: string; updated_at: string;
    }>("SELECT * FROM catalogs WHERE id = ?", [id]);
    return row ? toRecord(row) : null;
  }

  async list(): Promise<CatalogRecord[]> {
    const rows = await this.driver.query<{
      id: string; name: string; data: string; created_at: string; updated_at: string;
    }>("SELECT * FROM catalogs ORDER BY updated_at DESC");
    return rows.map(toRecord);
  }

  async update(id: string, name: string, data: string): Promise<void> {
    await this.driver.execute(
      `UPDATE catalogs SET name = ?, data = ?, updated_at = ? WHERE id = ?`,
      [name, data, new Date().toISOString(), id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.driver.execute("DELETE FROM catalogs WHERE id = ?", [id]);
  }
}

function toRecord(row: {
  id: string; name: string; data: string; created_at: string; updated_at: string;
}): CatalogRecord {
  return {
    id: row.id,
    name: row.name,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
