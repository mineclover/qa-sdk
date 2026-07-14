// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type { ReportingRepository } from './shared/port.js';

export type ReportingRepoDialect = 'sqlite' | 'pg';

export interface ReportingRepoFactoryOpts {
  dialect: ReportingRepoDialect;
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createReportingRepository(
  opts: ReportingRepoFactoryOpts,
): Promise<ReportingRepository> {
  if (opts.dialect === 'sqlite') {
    const { SqliteReportingRepository } = await import('./sqlite/adapter.js');
    return new SqliteReportingRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    const { PgReportingRepository } = await import('./pg/adapter.js');
    return new PgReportingRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createReportingRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
