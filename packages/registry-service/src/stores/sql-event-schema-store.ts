// @def.boundary registry-system
// @def.doc registry-system

import type { SqlDriver } from 'index-meta-store';
import type { EventSchemaRecord, EventSchemaStore } from './event-schema-store.js';

export class SqlEventSchemaStore implements EventSchemaStore {
  constructor(private readonly driver: SqlDriver) {}

  async upsert(record: EventSchemaRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO event_schema (catalog_id, service_id, event_key, event_version, display_name, description, record_kind, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (catalog_id, service_id, event_key, event_version)
       DO UPDATE SET display_name = excluded.display_name, description = excluded.description,
                     record_kind = excluded.record_kind, status = excluded.status, updated_at = excluded.updated_at`,
      [
        record.catalogId,
        record.serviceId,
        record.eventKey,
        record.eventVersion,
        record.displayName,
        record.description ?? null,
        record.recordKind,
        record.status,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async get(
    catalogId: string,
    serviceId: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<EventSchemaRecord | null> {
    const row = await this.driver.queryOne<Row>(
      'SELECT * FROM event_schema WHERE catalog_id = ? AND service_id = ? AND event_key = ? AND event_version = ?',
      [catalogId, serviceId, eventKey, eventVersion],
    );
    return row ? toRecord(row) : null;
  }

  async listByService(catalogId: string, serviceId: string): Promise<EventSchemaRecord[]> {
    const rows = await this.driver.query<Row>(
      'SELECT * FROM event_schema WHERE catalog_id = ? AND service_id = ? ORDER BY event_key, event_version',
      [catalogId, serviceId],
    );
    return rows.map(toRecord);
  }

  async list(catalogId: string): Promise<EventSchemaRecord[]> {
    const rows = await this.driver.query<Row>(
      'SELECT * FROM event_schema WHERE catalog_id = ? ORDER BY service_id, event_key, event_version',
      [catalogId],
    );
    return rows.map(toRecord);
  }

  async delete(
    catalogId: string,
    serviceId: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<boolean> {
    await this.driver.execute(
      'DELETE FROM event_schema WHERE catalog_id = ? AND service_id = ? AND event_key = ? AND event_version = ?',
      [catalogId, serviceId, eventKey, eventVersion],
    );
    return true;
  }
}

interface Row extends Record<string, unknown> {
  catalog_id: string;
  service_id: string;
  event_key: string;
  event_version: string;
  display_name: string;
  description: string | null;
  record_kind: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function toRecord(row: Row): EventSchemaRecord {
  return {
    catalogId: row.catalog_id,
    serviceId: row.service_id,
    eventKey: row.event_key,
    eventVersion: row.event_version,
    displayName: row.display_name,
    description: row.description ?? undefined,
    recordKind: row.record_kind as EventSchemaRecord['recordKind'],
    status: row.status as EventSchemaRecord['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
