// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { UserEntity } from '../../domain/index.js';
import type { UserSnapshot } from '../../domain/index.js';
import { UserRepositoryPort } from '../../application/ports/user-repository.port.js';
import type { UserTransactionScope } from '../../application/ports/user-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  primaryRoleId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: UserRow): UserSnapshot {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    departmentId: row.departmentId,
    primaryRoleId: row.primaryRoleId,
    status: 'active',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(snapshot: UserSnapshot): UserRow {
  return {
    id: snapshot.id,
    email: snapshot.email,
    displayName: snapshot.displayName,
    departmentId: snapshot.departmentId,
    primaryRoleId: snapshot.primaryRoleId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

export class SqliteUserRepository extends UserRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: UserEntity, _scope: UserTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.users)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.users.id,
        set: {
          email: row.email,
          displayName: row.displayName,
          departmentId: row.departmentId,
          primaryRoleId: row.primaryRoleId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<UserEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.users)
      .where(eq(sqliteSchema.users.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return UserEntity.rehydrate(toSnapshot(rows[0] as UserRow));
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.users)
      .where(eq(sqliteSchema.users.email, email))
      .limit(1);
    if (rows.length === 0) return null;
    return UserEntity.rehydrate(toSnapshot(rows[0] as UserRow));
  }

  async listByDepartment(departmentId: string): Promise<UserEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.users)
      .where(eq(sqliteSchema.users.departmentId, departmentId));
    return rows.map((r) => UserEntity.rehydrate(toSnapshot(r as UserRow)));
  }

  async delete(id: string, _scope: UserTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.users).where(eq(sqliteSchema.users.id, id));
  }
}

export class PgUserRepository extends UserRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: UserEntity, _scope: UserTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.users)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.users.id,
        set: {
          email: row.email,
          displayName: row.displayName,
          departmentId: row.departmentId,
          primaryRoleId: row.primaryRoleId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<UserEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.users)
      .where(eq(pgSchema.users.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return UserEntity.rehydrate(toSnapshot(rows[0] as UserRow));
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.users)
      .where(eq(pgSchema.users.email, email))
      .limit(1);
    if (rows.length === 0) return null;
    return UserEntity.rehydrate(toSnapshot(rows[0] as UserRow));
  }

  async listByDepartment(departmentId: string): Promise<UserEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.users)
      .where(eq(pgSchema.users.departmentId, departmentId));
    return rows.map((r) => UserEntity.rehydrate(toSnapshot(r as UserRow)));
  }

  async delete(id: string, _scope: UserTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.users).where(eq(pgSchema.users.id, id));
  }
}

export type UserDialect = 'sqlite' | 'pg';

export interface UserRepositoryFactoryOpts {
  readonly dialect: UserDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createUserRepository(opts: UserRepositoryFactoryOpts): UserRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteUserRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgUserRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createUserRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
