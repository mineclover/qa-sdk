// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { BudgetEntity } from '../../domain/index.js';
import type { BudgetSnapshot } from '../../domain/index.js';
import { BudgetRepositoryPort } from '../../application/ports/budget-repository.port.js';
import type { BudgetTransactionScope } from '../../application/ports/budget-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface BudgetRow {
  id: string;
  projectId: string;
  projectDepartmentId: string;
  amount: number;
  requesterId: string;
  status: BudgetSnapshot['status'];
  currentStage: number;
  totalStages: number;
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: BudgetRow): BudgetSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    projectDepartmentId: row.projectDepartmentId,
    amount: row.amount,
    requesterId: row.requesterId,
    status: row.status,
    currentStage: row.currentStage,
    totalStages: row.totalStages,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(snapshot: BudgetSnapshot): BudgetRow {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    projectDepartmentId: snapshot.projectDepartmentId,
    amount: snapshot.amount,
    requesterId: snapshot.requesterId,
    status: snapshot.status,
    currentStage: snapshot.currentStage,
    totalStages: snapshot.totalStages,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

export class SqliteBudgetRepository extends BudgetRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }
  async save(entity: BudgetEntity, _scope: BudgetTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.budgetRequests)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.budgetRequests.id,
        set: {
          status: row.status,
          currentStage: row.currentStage,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<BudgetEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.budgetRequests)
      .where(eq(sqliteSchema.budgetRequests.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return BudgetEntity.rehydrate(toSnapshot(rows[0] as BudgetRow));
  }
  async listByProject(projectId: string): Promise<BudgetEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.budgetRequests)
      .where(eq(sqliteSchema.budgetRequests.projectId, projectId));
    return (rows as BudgetRow[]).map((r) => BudgetEntity.rehydrate(toSnapshot(r)));
  }
  async listByRequester(requesterId: string): Promise<BudgetEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.budgetRequests)
      .where(eq(sqliteSchema.budgetRequests.requesterId, requesterId));
    return (rows as BudgetRow[]).map((r) => BudgetEntity.rehydrate(toSnapshot(r)));
  }
}

export class PgBudgetRepository extends BudgetRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }
  async save(entity: BudgetEntity, _scope: BudgetTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.budgetRequests)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.budgetRequests.id,
        set: {
          status: row.status,
          currentStage: row.currentStage,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<BudgetEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.budgetRequests)
      .where(eq(pgSchema.budgetRequests.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return BudgetEntity.rehydrate(toSnapshot(rows[0] as BudgetRow));
  }
}

export type BudgetDialect = 'sqlite' | 'pg';

export interface BudgetRepositoryFactoryOpts {
  readonly dialect: BudgetDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createBudgetRepository(opts: BudgetRepositoryFactoryOpts): BudgetRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteBudgetRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgBudgetRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createBudgetRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
