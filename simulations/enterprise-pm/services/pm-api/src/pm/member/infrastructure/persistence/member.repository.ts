// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { MemberEntity } from "../../domain/index.js";
import type { MemberSnapshot, MemberRole } from "../../domain/index.js";
import { MemberRepositoryPort } from "../../application/ports/member-repository.port.js";
import type { MemberTransactionScope } from "../../application/ports/member-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface MemberRow {
  projectId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

function toSnapshot(row: MemberRow): MemberSnapshot {
  return {
    projectId: row.projectId,
    userId: row.userId,
    role: row.role,
    joinedAt: row.joinedAt,
  };
}

function toRow(snapshot: MemberSnapshot): MemberRow {
  return {
    projectId: snapshot.projectId,
    userId: snapshot.userId,
    role: snapshot.role,
    joinedAt: snapshot.joinedAt,
  };
}

export class SqliteMemberRepository extends MemberRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: MemberEntity, _scope: MemberTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.projectMembers)
      .values(row)
      .onConflictDoUpdate({
        target: [sqliteSchema.projectMembers.projectId, sqliteSchema.projectMembers.userId],
        set: { role: row.role },
      });
  }

  async findById(projectId: string, userId: string): Promise<MemberEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.projectMembers)
      .where(
        and(
          eq(sqliteSchema.projectMembers.projectId, projectId),
          eq(sqliteSchema.projectMembers.userId, userId),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return MemberEntity.rehydrate(toSnapshot(rows[0] as MemberRow));
  }

  async listForProject(projectId: string): Promise<MemberEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.projectMembers)
      .where(eq(sqliteSchema.projectMembers.projectId, projectId));
    return rows.map((row) => MemberEntity.rehydrate(toSnapshot(row as MemberRow)));
  }

  async listForUser(userId: string): Promise<MemberEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.projectMembers)
      .where(eq(sqliteSchema.projectMembers.userId, userId));
    return rows.map((row) => MemberEntity.rehydrate(toSnapshot(row as MemberRow)));
  }

  async delete(projectId: string, userId: string, _scope: MemberTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.projectMembers).where(
      and(
        eq(sqliteSchema.projectMembers.projectId, projectId),
        eq(sqliteSchema.projectMembers.userId, userId),
      ),
    );
  }
}

export class PgMemberRepository extends MemberRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: MemberEntity, _scope: MemberTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.projectMembers)
      .values(row)
      .onConflictDoUpdate({
        target: [pgSchema.projectMembers.projectId, pgSchema.projectMembers.userId],
        set: { role: row.role },
      });
  }

  async findById(projectId: string, userId: string): Promise<MemberEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.projectMembers)
      .where(
        and(
          eq(pgSchema.projectMembers.projectId, projectId),
          eq(pgSchema.projectMembers.userId, userId),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return MemberEntity.rehydrate(toSnapshot(rows[0] as MemberRow));
  }

  async listForProject(projectId: string): Promise<MemberEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.projectMembers)
      .where(eq(pgSchema.projectMembers.projectId, projectId));
    return rows.map((row) => MemberEntity.rehydrate(toSnapshot(row as MemberRow)));
  }

  async listForUser(userId: string): Promise<MemberEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.projectMembers)
      .where(eq(pgSchema.projectMembers.userId, userId));
    return rows.map((row) => MemberEntity.rehydrate(toSnapshot(row as MemberRow)));
  }

  async delete(projectId: string, userId: string, _scope: MemberTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.projectMembers).where(
      and(
        eq(pgSchema.projectMembers.projectId, projectId),
        eq(pgSchema.projectMembers.userId, userId),
      ),
    );
  }
}

export type MemberDialect = "sqlite" | "pg";

export interface MemberRepositoryFactoryOpts {
  readonly dialect: MemberDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createMemberRepository(
  opts: MemberRepositoryFactoryOpts,
): MemberRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteMemberRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgMemberRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createMemberRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
