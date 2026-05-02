// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { ExpenseEntity } from "../../domain/index.js";
import type { ExpenseSnapshot } from "../../domain/index.js";
import { ExpenseRepositoryPort } from "../../application/ports/expense-repository.port.js";
import type { ExpenseTransactionScope } from "../../application/ports/expense-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface ExpenseRow {
  id: string;
  requesterId: string;
  amount: number;
  category: string;
  description: string;
  status: ExpenseSnapshot["status"];
  createdAt: string;
  updatedAt: string;
}

function toSnap(r: ExpenseRow): ExpenseSnapshot {
  return r;
}

function toRow(s: ExpenseSnapshot): ExpenseRow {
  return s;
}

export class SqliteExpenseRepository extends ExpenseRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }
  async save(entity: ExpenseEntity, _scope: ExpenseTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.expenseReports)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.expenseReports.id,
        set: {
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<ExpenseEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.expenseReports)
      .where(eq(sqliteSchema.expenseReports.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return ExpenseEntity.rehydrate(toSnap(rows[0] as ExpenseRow));
  }
}

export class PgExpenseRepository extends ExpenseRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }
  async save(entity: ExpenseEntity, _scope: ExpenseTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.expenseReports)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.expenseReports.id,
        set: {
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
  async findById(id: string): Promise<ExpenseEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.expenseReports)
      .where(eq(pgSchema.expenseReports.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return ExpenseEntity.rehydrate(toSnap(rows[0] as ExpenseRow));
  }
}

export type ExpenseDialect = "sqlite" | "pg";

export interface ExpenseRepositoryFactoryOpts {
  readonly dialect: ExpenseDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createExpenseRepository(
  opts: ExpenseRepositoryFactoryOpts,
): ExpenseRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteExpenseRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgExpenseRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createExpenseRepository: 지원하지 않는 dialect=${(opts as { dialect: string }).dialect}`);
}
