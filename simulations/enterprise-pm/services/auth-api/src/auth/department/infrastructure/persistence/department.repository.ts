// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DepartmentEntity } from '../../domain/index.js';
import type { DepartmentSnapshot } from '../../domain/index.js';
import { DepartmentRepositoryPort } from '../../application/ports/department-repository.port.js';
import type { DepartmentTransactionScope } from '../../application/ports/department-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface DepartmentRow {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: DepartmentRow): DepartmentSnapshot {
  return { ...row };
}

function toRow(snapshot: DepartmentSnapshot): DepartmentRow {
  return { ...snapshot };
}

export class SqliteDepartmentRepository extends DepartmentRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: DepartmentEntity, _scope: DepartmentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.departments)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.departments.id,
        set: {
          name: row.name,
          parentId: row.parentId,
          managerId: row.managerId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<DepartmentEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.departments)
      .where(eq(sqliteSchema.departments.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return DepartmentEntity.rehydrate(toSnapshot(rows[0] as DepartmentRow));
  }

  async list(): Promise<DepartmentEntity[]> {
    const rows = await this.db.select().from(sqliteSchema.departments);
    return rows.map((r) => DepartmentEntity.rehydrate(toSnapshot(r as DepartmentRow)));
  }

  async resolveChain(id: string): Promise<DepartmentEntity[]> {
    const chain: DepartmentEntity[] = [];
    let curId: string | null = id;
    const seen = new Set<string>();
    while (curId && !seen.has(curId)) {
      seen.add(curId);
      const dept = await this.findById(curId);
      if (!dept) break;
      chain.push(dept);
      curId = dept.parentId;
    }
    return chain;
  }

  async delete(id: string, _scope: DepartmentTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.departments).where(eq(sqliteSchema.departments.id, id));
  }
}

export class PgDepartmentRepository extends DepartmentRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: DepartmentEntity, _scope: DepartmentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.departments)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.departments.id,
        set: {
          name: row.name,
          parentId: row.parentId,
          managerId: row.managerId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<DepartmentEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.departments)
      .where(eq(pgSchema.departments.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return DepartmentEntity.rehydrate(toSnapshot(rows[0] as DepartmentRow));
  }

  async list(): Promise<DepartmentEntity[]> {
    const rows = await this.db.select().from(pgSchema.departments);
    return rows.map((r) => DepartmentEntity.rehydrate(toSnapshot(r as DepartmentRow)));
  }

  async resolveChain(id: string): Promise<DepartmentEntity[]> {
    const chain: DepartmentEntity[] = [];
    let curId: string | null = id;
    const seen = new Set<string>();
    while (curId && !seen.has(curId)) {
      seen.add(curId);
      const dept = await this.findById(curId);
      if (!dept) break;
      chain.push(dept);
      curId = dept.parentId;
    }
    return chain;
  }

  async delete(id: string, _scope: DepartmentTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.departments).where(eq(pgSchema.departments.id, id));
  }
}

export type DepartmentDialect = 'sqlite' | 'pg';

export interface DepartmentRepositoryFactoryOpts {
  readonly dialect: DepartmentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createDepartmentRepository(
  opts: DepartmentRepositoryFactoryOpts,
): DepartmentRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteDepartmentRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgDepartmentRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createDepartmentRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
