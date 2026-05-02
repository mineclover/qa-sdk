// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { and, eq, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { RoleAssignmentEntity } from "../../domain/index.js";
import type {
  AssignmentScopeType,
  RoleAssignmentSnapshot,
} from "../../domain/index.js";
import { RoleAssignmentRepositoryPort } from "../../application/ports/role-assignment-repository.port.js";
import type { RoleAssignmentTransactionScope } from "../../application/ports/role-assignment-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface RoleAssignmentRow {
  userId: string;
  roleId: string;
  scopeType: AssignmentScopeType;
  scopeId: string | null;
  assignedAt: string;
}

function toSnapshot(row: RoleAssignmentRow): RoleAssignmentSnapshot {
  return {
    id: `${row.userId}|${row.roleId}|${row.scopeType}|${row.scopeId ?? ""}`,
    userId: row.userId,
    roleId: row.roleId,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    assignedAt: row.assignedAt,
  };
}

/** PG sentinel '' → null (port 경계 매핑). */
function decodeScopeId(scopeId: string | null): string | null {
  return scopeId === null || scopeId === "" ? null : scopeId;
}

/** null → '' (PG NOT NULL PRIMARY KEY 호환). */
function encodeScopeIdPg(scopeId: string | null): string {
  return scopeId ?? "";
}

export class SqliteRoleAssignmentRepository extends RoleAssignmentRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: RoleAssignmentEntity, _scope: RoleAssignmentTransactionScope): Promise<void> {
    const s = entity.toSnapshot();
    await this.db
      .insert(sqliteSchema.roleAssignments)
      .values({
        userId: s.userId,
        roleId: s.roleId,
        scopeType: s.scopeType,
        scopeId: s.scopeId,
        assignedAt: s.assignedAt,
      })
      .onConflictDoNothing();
  }

  async findOne(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<RoleAssignmentEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.roleAssignments)
      .where(
        and(
          eq(sqliteSchema.roleAssignments.userId, userId),
          eq(sqliteSchema.roleAssignments.roleId, roleId),
          eq(sqliteSchema.roleAssignments.scopeType, scopeType as AssignmentScopeType),
          scopeId === null
            ? isNull(sqliteSchema.roleAssignments.scopeId)
            : eq(sqliteSchema.roleAssignments.scopeId, scopeId),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return RoleAssignmentEntity.rehydrate(toSnapshot(rows[0] as RoleAssignmentRow));
  }

  async listForUser(userId: string): Promise<RoleAssignmentEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.roleAssignments)
      .where(eq(sqliteSchema.roleAssignments.userId, userId));
    return rows.map((r) => RoleAssignmentEntity.rehydrate(toSnapshot(r as RoleAssignmentRow)));
  }

  async delete(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
    _scope: RoleAssignmentTransactionScope,
  ): Promise<void> {
    await this.db.delete(sqliteSchema.roleAssignments).where(
      and(
        eq(sqliteSchema.roleAssignments.userId, userId),
        eq(sqliteSchema.roleAssignments.roleId, roleId),
        eq(sqliteSchema.roleAssignments.scopeType, scopeType as AssignmentScopeType),
        scopeId === null
          ? isNull(sqliteSchema.roleAssignments.scopeId)
          : eq(sqliteSchema.roleAssignments.scopeId, scopeId),
      ),
    );
  }
}

export class PgRoleAssignmentRepository extends RoleAssignmentRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: RoleAssignmentEntity, _scope: RoleAssignmentTransactionScope): Promise<void> {
    const s = entity.toSnapshot();
    await this.db
      .insert(pgSchema.roleAssignments)
      .values({
        userId: s.userId,
        roleId: s.roleId,
        scopeType: s.scopeType,
        scopeId: encodeScopeIdPg(s.scopeId),
        assignedAt: s.assignedAt,
      })
      .onConflictDoNothing();
  }

  async findOne(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<RoleAssignmentEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.roleAssignments)
      .where(
        and(
          eq(pgSchema.roleAssignments.userId, userId),
          eq(pgSchema.roleAssignments.roleId, roleId),
          eq(pgSchema.roleAssignments.scopeType, scopeType as AssignmentScopeType),
          eq(pgSchema.roleAssignments.scopeId, encodeScopeIdPg(scopeId)),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0] as RoleAssignmentRow;
    return RoleAssignmentEntity.rehydrate(
      toSnapshot({ ...row, scopeId: decodeScopeId(row.scopeId) }),
    );
  }

  async listForUser(userId: string): Promise<RoleAssignmentEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.roleAssignments)
      .where(eq(pgSchema.roleAssignments.userId, userId));
    return rows.map((r) => {
      const row = r as RoleAssignmentRow;
      return RoleAssignmentEntity.rehydrate(
        toSnapshot({ ...row, scopeId: decodeScopeId(row.scopeId) }),
      );
    });
  }

  async delete(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
    _scope: RoleAssignmentTransactionScope,
  ): Promise<void> {
    await this.db.delete(pgSchema.roleAssignments).where(
      and(
        eq(pgSchema.roleAssignments.userId, userId),
        eq(pgSchema.roleAssignments.roleId, roleId),
        eq(pgSchema.roleAssignments.scopeType, scopeType as AssignmentScopeType),
        eq(pgSchema.roleAssignments.scopeId, encodeScopeIdPg(scopeId)),
      ),
    );
  }
}

export type RoleAssignmentDialect = "sqlite" | "pg";

export interface RoleAssignmentRepositoryFactoryOpts {
  readonly dialect: RoleAssignmentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createRoleAssignmentRepository(
  opts: RoleAssignmentRepositoryFactoryOpts,
): RoleAssignmentRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteRoleAssignmentRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgRoleAssignmentRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createRoleAssignmentRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
