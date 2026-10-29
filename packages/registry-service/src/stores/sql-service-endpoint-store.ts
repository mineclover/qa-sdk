// @def.boundary registry-system
// @def.doc registry-system

import type { SqlDriver } from 'index-meta-store';
import type { ServiceEndpointRecord, ServiceEndpointStore } from './service-endpoint-store.js';

export class SqlServiceEndpointStore implements ServiceEndpointStore {
  constructor(private readonly driver: SqlDriver) {}

  async upsert(record: ServiceEndpointRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO service_endpoint (catalog_id, namespace, svc_name, env, region, url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (catalog_id, namespace, svc_name, env, region)
       DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at`,
      [
        record.catalogId,
        record.namespace,
        record.svcName,
        record.env,
        record.region,
        record.url,
        record.updatedAt,
      ],
    );
  }

  async get(
    catalogId: string,
    ns: string,
    svc: string,
    env: string,
    region: string,
  ): Promise<ServiceEndpointRecord | null> {
    const row = await this.driver.queryOne<Row>(
      'SELECT * FROM service_endpoint WHERE catalog_id = ? AND namespace = ? AND svc_name = ? AND env = ? AND region = ?',
      [catalogId, ns, svc, env, region],
    );
    return row ? toRecord(row) : null;
  }

  async listByService(
    catalogId: string,
    ns: string,
    svc: string,
  ): Promise<ServiceEndpointRecord[]> {
    const rows = await this.driver.query<Row>(
      'SELECT * FROM service_endpoint WHERE catalog_id = ? AND namespace = ? AND svc_name = ? ORDER BY env, region',
      [catalogId, ns, svc],
    );
    return rows.map(toRecord);
  }

  async list(catalogId: string): Promise<ServiceEndpointRecord[]> {
    const rows = await this.driver.query<Row>(
      'SELECT * FROM service_endpoint WHERE catalog_id = ? ORDER BY namespace, svc_name, env, region',
      [catalogId],
    );
    return rows.map(toRecord);
  }

  async delete(
    catalogId: string,
    ns: string,
    svc: string,
    env: string,
    region: string,
  ): Promise<void> {
    await this.driver.execute(
      'DELETE FROM service_endpoint WHERE catalog_id = ? AND namespace = ? AND svc_name = ? AND env = ? AND region = ?',
      [catalogId, ns, svc, env, region],
    );
  }
}

interface Row extends Record<string, unknown> {
  catalog_id: string;
  namespace: string;
  svc_name: string;
  env: string;
  region: string;
  url: string;
  updated_at: string;
}

function toRecord(row: Row): ServiceEndpointRecord {
  return {
    catalogId: row.catalog_id,
    namespace: row.namespace,
    svcName: row.svc_name,
    env: row.env,
    region: row.region,
    url: row.url,
    updatedAt: row.updated_at,
  };
}
