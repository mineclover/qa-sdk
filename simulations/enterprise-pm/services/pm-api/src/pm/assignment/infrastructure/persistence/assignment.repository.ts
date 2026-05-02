// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { AssignmentEntity } from "../../domain/index.js";
import type { AssignmentSnapshot } from "../../domain/index.js";
import { AssignmentRepositoryPort } from "../../application/ports/assignment-repository.port.js";
import type { AssignmentTransactionScope } from "../../application/ports/assignment-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

/**
 * Drizzle assignments table 의 row shape — sqlite/pg 양쪽 모두 동일 컬럼.
 *
 * snake_case 컬럼은 drizzle table object 의 JS 필드명 (camelCase 매핑) 으로
 * 노출되므로 어댑터 내부에서 매핑한다.
 */
interface AssignmentRow {
  id: string;
  projectId: string;
  managerId: string;
  status: "draft" | "assigned" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: AssignmentRow): AssignmentSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    managerId: row.managerId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(snapshot: AssignmentSnapshot): AssignmentRow {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    managerId: snapshot.managerId,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

/**
 * SQLite 어댑터.
 *
 * 트랜잭션 범위는 createSqliteTransactionPort 가 BEGIN/COMMIT 으로 관리하므로
 * 본 어댑터는 단순히 db.insert/select 를 발행. scope 는 atomic 단위 식별 용도로
 * 받지만 별도 동작 분기 없음 (auto-commit 외부 호출 시에도 동일 동작).
 */
export class SqliteAssignmentRepository extends AssignmentRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: AssignmentEntity, _scope: AssignmentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    // upsert: PRIMARY KEY 충돌 시 update.
    await this.db
      .insert(sqliteSchema.assignments)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.assignments.id,
        set: {
          projectId: row.projectId,
          managerId: row.managerId,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<AssignmentEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.assignments)
      .where(eq(sqliteSchema.assignments.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return AssignmentEntity.rehydrate(toSnapshot(rows[0] as AssignmentRow));
  }
}

/** Postgres 어댑터 — sqlite 와 동일한 매핑, 다른 schema(sim.pm_assignments). */
export class PgAssignmentRepository extends AssignmentRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: AssignmentEntity, _scope: AssignmentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.assignments)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.assignments.id,
        set: {
          projectId: row.projectId,
          managerId: row.managerId,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<AssignmentEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.assignments)
      .where(eq(pgSchema.assignments.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return AssignmentEntity.rehydrate(toSnapshot(rows[0] as AssignmentRow));
  }
}

export type AssignmentDialect = "sqlite" | "pg";

export interface AssignmentRepositoryFactoryOpts {
  readonly dialect: AssignmentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

/** dialect 분기 — pm-db.module 의 PM_DB_INSTANCE handle 에서 호출. */
export function createAssignmentRepository(
  opts: AssignmentRepositoryFactoryOpts,
): AssignmentRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteAssignmentRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgAssignmentRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createAssignmentRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
