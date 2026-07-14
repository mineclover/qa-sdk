// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { TimeOffEntity } from '../../domain/index.js';
import type { TimeOffSnapshot } from '../../domain/index.js';
import { TimeOffRepositoryPort } from '../../application/ports/timeoff-repository.port.js';
import type { TimeOffTransactionScope } from '../../application/ports/timeoff-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface TimeOffRow {
  id: string;
  requesterId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: TimeOffSnapshot['status'];
  createdAt: string;
  updatedAt: string;
}

export class SqliteTimeOffRepository extends TimeOffRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }
  async save(entity: TimeOffEntity, _scope: TimeOffTransactionScope): Promise<void> {
    const row = entity.toSnapshot() as TimeOffRow;
    await this.db
      .insert(sqliteSchema.timeOffRequests)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.timeOffRequests.id,
        set: {
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<TimeOffEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.timeOffRequests)
      .where(eq(sqliteSchema.timeOffRequests.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return TimeOffEntity.rehydrate(rows[0] as TimeOffRow);
  }
}

export class PgTimeOffRepository extends TimeOffRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }
  async save(entity: TimeOffEntity, _scope: TimeOffTransactionScope): Promise<void> {
    const row = entity.toSnapshot() as TimeOffRow;
    await this.db
      .insert(pgSchema.timeOffRequests)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.timeOffRequests.id,
        set: {
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<TimeOffEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.timeOffRequests)
      .where(eq(pgSchema.timeOffRequests.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return TimeOffEntity.rehydrate(rows[0] as TimeOffRow);
  }
}

export type TimeOffDialect = 'sqlite' | 'pg';

export interface TimeOffRepositoryFactoryOpts {
  readonly dialect: TimeOffDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createTimeOffRepository(opts: TimeOffRepositoryFactoryOpts): TimeOffRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteTimeOffRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgTimeOffRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createTimeOffRepository: dialect=${(opts as { dialect: string }).dialect}`);
}
