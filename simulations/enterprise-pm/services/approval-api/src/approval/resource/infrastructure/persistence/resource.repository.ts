// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { ResourceEntity } from '../../domain/index.js';
import type { ResourceSnapshot } from '../../domain/index.js';
import { ResourceRepositoryPort } from '../../application/ports/resource-repository.port.js';
import type { ResourceTransactionScope } from '../../application/ports/resource-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface ResourceRow {
  id: string;
  projectId: string;
  requesterId: string;
  resourceType: string;
  description: string;
  status: ResourceSnapshot['status'];
  createdAt: string;
  updatedAt: string;
}

export class SqliteResourceRepository extends ResourceRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }
  async save(entity: ResourceEntity, _scope: ResourceTransactionScope): Promise<void> {
    const row = entity.toSnapshot() as ResourceRow;
    await this.db
      .insert(sqliteSchema.resourceRequests)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.resourceRequests.id,
        set: {
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<ResourceEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.resourceRequests)
      .where(eq(sqliteSchema.resourceRequests.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return ResourceEntity.rehydrate(rows[0] as ResourceRow);
  }
}

export class PgResourceRepository extends ResourceRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }
  async save(entity: ResourceEntity, _scope: ResourceTransactionScope): Promise<void> {
    const row = entity.toSnapshot() as ResourceRow;
    await this.db
      .insert(pgSchema.resourceRequests)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.resourceRequests.id,
        set: {
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<ResourceEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.resourceRequests)
      .where(eq(pgSchema.resourceRequests.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return ResourceEntity.rehydrate(rows[0] as ResourceRow);
  }
}

export type ResourceDialect = 'sqlite' | 'pg';

export interface ResourceRepositoryFactoryOpts {
  readonly dialect: ResourceDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createResourceRepository(
  opts: ResourceRepositoryFactoryOpts,
): ResourceRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteResourceRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgResourceRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createResourceRepository: dialect=${(opts as { dialect: string }).dialect}`);
}
