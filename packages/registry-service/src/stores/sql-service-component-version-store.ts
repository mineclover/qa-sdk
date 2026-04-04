import type { SqlDriver } from "index-meta";
import type { ComponentVersionKind } from "../modules/services/service.types.js";
import type {
  ServiceComponentVersionRecord,
  ServiceComponentVersionStore,
} from "./service-component-version-store.js";

export class SqlServiceComponentVersionStore implements ServiceComponentVersionStore {
  constructor(private readonly driver: SqlDriver) {}

  async upsert(record: ServiceComponentVersionRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO service_component_version (
         catalog_id, kind, service_id, version, state, value_json, created_at, updated_at, published_at, deprecated_at, archived_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (catalog_id, kind, service_id, version)
       DO UPDATE SET
         state = excluded.state,
         value_json = excluded.value_json,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         published_at = excluded.published_at,
         deprecated_at = excluded.deprecated_at,
         archived_at = excluded.archived_at`,
      [
        record.catalogId,
        record.kind,
        record.serviceId,
        record.version,
        record.state,
        record.valueJson,
        record.createdAt,
        record.updatedAt,
        record.publishedAt ?? null,
        record.deprecatedAt ?? null,
        record.archivedAt ?? null,
      ],
    );
  }

  async get(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
    version: string,
  ): Promise<ServiceComponentVersionRecord | null> {
    const row = await this.driver.queryOne<Row>(
      `SELECT * FROM service_component_version
       WHERE catalog_id = ? AND kind = ? AND service_id = ? AND version = ?`,
      [catalogId, kind, serviceId, version],
    );
    return row ? toRecord(row) : null;
  }

  async listVersions(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
  ): Promise<ServiceComponentVersionRecord[]> {
    const rows = await this.driver.query<Row>(
      `SELECT * FROM service_component_version
       WHERE catalog_id = ? AND kind = ? AND service_id = ?
       ORDER BY version`,
      [catalogId, kind, serviceId],
    );
    return rows.map(toRecord);
  }
}

interface Row extends Record<string, unknown> {
  catalog_id: string;
  kind: string;
  service_id: string;
  version: string;
  state: string;
  value_json: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deprecated_at: string | null;
  archived_at: string | null;
}

function toRecord(row: Row): ServiceComponentVersionRecord {
  return {
    catalogId: row.catalog_id,
    kind: row.kind as ComponentVersionKind,
    serviceId: row.service_id,
    version: row.version,
    state: row.state as ServiceComponentVersionRecord["state"],
    valueJson: row.value_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    ...(row.deprecated_at ? { deprecatedAt: row.deprecated_at } : {}),
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
  };
}
