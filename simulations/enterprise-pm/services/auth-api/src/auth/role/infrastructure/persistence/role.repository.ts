// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { RoleEntity } from "../../domain/index.js";
import type { RoleSnapshot, RoleScopeType } from "../../domain/index.js";
import { RoleRepositoryPort } from "../../application/ports/role-repository.port.js";
import type { RoleTransactionScope } from "../../application/ports/role-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface RoleRow {
  id: string;
  name: string;
  scopeType: RoleScopeType;
  defaultMaskHex: string;
  createdAt: string;
}

function toSnapshot(row: RoleRow): RoleSnapshot {
  return {
    id: row.id,
    name: row.name,
    scopeType: row.scopeType,
    defaultMaskHex: row.defaultMaskHex,
    createdAt: row.createdAt,
  };
}

function toRow(snapshot: RoleSnapshot): RoleRow {
  return {
    id: snapshot.id,
    name: snapshot.name,
    scopeType: snapshot.scopeType,
    defaultMaskHex: snapshot.defaultMaskHex,
    createdAt: snapshot.createdAt,
  };
}

export class SqliteRoleRepository extends RoleRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: RoleEntity, _scope: RoleTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db.insert(sqliteSchema.roles).values(row).onConflictDoUpdate({
      target: sqliteSchema.roles.id,
      set: { name: row.name, scopeType: row.scopeType, defaultMaskHex: row.defaultMaskHex },
    });
  }

  async findById(id: string): Promise<RoleEntity | null> {
    const rows = await this.db.select().from(sqliteSchema.roles).where(eq(sqliteSchema.roles.id, id)).limit(1);
    if (rows.length === 0) return null;
    return RoleEntity.rehydrate(toSnapshot(rows[0] as RoleRow));
  }

  async findByName(name: string): Promise<RoleEntity | null> {
    const rows = await this.db.select().from(sqliteSchema.roles).where(eq(sqliteSchema.roles.name, name)).limit(1);
    if (rows.length === 0) return null;
    return RoleEntity.rehydrate(toSnapshot(rows[0] as RoleRow));
  }

  async list(): Promise<RoleEntity[]> {
    const rows = await this.db.select().from(sqliteSchema.roles);
    return rows.map((r) => RoleEntity.rehydrate(toSnapshot(r as RoleRow)));
  }

  async delete(id: string, _scope: RoleTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.roles).where(eq(sqliteSchema.roles.id, id));
  }
}

export class PgRoleRepository extends RoleRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: RoleEntity, _scope: RoleTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db.insert(pgSchema.roles).values(row).onConflictDoUpdate({
      target: pgSchema.roles.id,
      set: { name: row.name, scopeType: row.scopeType, defaultMaskHex: row.defaultMaskHex },
    });
  }

  async findById(id: string): Promise<RoleEntity | null> {
    const rows = await this.db.select().from(pgSchema.roles).where(eq(pgSchema.roles.id, id)).limit(1);
    if (rows.length === 0) return null;
    return RoleEntity.rehydrate(toSnapshot(rows[0] as RoleRow));
  }

  async findByName(name: string): Promise<RoleEntity | null> {
    const rows = await this.db.select().from(pgSchema.roles).where(eq(pgSchema.roles.name, name)).limit(1);
    if (rows.length === 0) return null;
    return RoleEntity.rehydrate(toSnapshot(rows[0] as RoleRow));
  }

  async list(): Promise<RoleEntity[]> {
    const rows = await this.db.select().from(pgSchema.roles);
    return rows.map((r) => RoleEntity.rehydrate(toSnapshot(r as RoleRow)));
  }

  async delete(id: string, _scope: RoleTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.roles).where(eq(pgSchema.roles.id, id));
  }
}

export type RoleDialect = "sqlite" | "pg";

export interface RoleRepositoryFactoryOpts {
  readonly dialect: RoleDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createRoleRepository(opts: RoleRepositoryFactoryOpts): RoleRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteRoleRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgRoleRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createRoleRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
