// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { ProjectEntity } from "../../domain/index.js";
import type { ProjectSnapshot, ProjectStatus } from "../../domain/index.js";
import { ProjectRepositoryPort } from "../../application/ports/project-repository.port.js";
import type { ProjectTransactionScope } from "../../application/ports/project-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface ProjectRow {
  id: string;
  name: string;
  ownerId: string;
  departmentId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: ProjectRow): ProjectSnapshot {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    departmentId: row.departmentId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(snapshot: ProjectSnapshot): ProjectRow {
  return {
    id: snapshot.id,
    name: snapshot.name,
    ownerId: snapshot.ownerId,
    departmentId: snapshot.departmentId,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

export class SqliteProjectRepository extends ProjectRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: ProjectEntity, _scope: ProjectTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.projects)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.projects.id,
        set: {
          name: row.name,
          ownerId: row.ownerId,
          departmentId: row.departmentId,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.projects)
      .where(eq(sqliteSchema.projects.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return ProjectEntity.rehydrate(toSnapshot(rows[0] as ProjectRow));
  }

  async listByDepartment(departmentId: string): Promise<ProjectEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.projects)
      .where(eq(sqliteSchema.projects.departmentId, departmentId));
    return rows.map((row) => ProjectEntity.rehydrate(toSnapshot(row as ProjectRow)));
  }

  async listByOwner(ownerId: string): Promise<ProjectEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.projects)
      .where(eq(sqliteSchema.projects.ownerId, ownerId));
    return rows.map((row) => ProjectEntity.rehydrate(toSnapshot(row as ProjectRow)));
  }

  async delete(id: string, _scope: ProjectTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.projects).where(eq(sqliteSchema.projects.id, id));
  }
}

export class PgProjectRepository extends ProjectRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: ProjectEntity, _scope: ProjectTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.projects)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.projects.id,
        set: {
          name: row.name,
          ownerId: row.ownerId,
          departmentId: row.departmentId,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.projects)
      .where(eq(pgSchema.projects.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return ProjectEntity.rehydrate(toSnapshot(rows[0] as ProjectRow));
  }

  async listByDepartment(departmentId: string): Promise<ProjectEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.projects)
      .where(eq(pgSchema.projects.departmentId, departmentId));
    return rows.map((row) => ProjectEntity.rehydrate(toSnapshot(row as ProjectRow)));
  }

  async listByOwner(ownerId: string): Promise<ProjectEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.projects)
      .where(eq(pgSchema.projects.ownerId, ownerId));
    return rows.map((row) => ProjectEntity.rehydrate(toSnapshot(row as ProjectRow)));
  }

  async delete(id: string, _scope: ProjectTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.projects).where(eq(pgSchema.projects.id, id));
  }
}

export type ProjectDialect = "sqlite" | "pg";

export interface ProjectRepositoryFactoryOpts {
  readonly dialect: ProjectDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createProjectRepository(
  opts: ProjectRepositoryFactoryOpts,
): ProjectRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteProjectRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgProjectRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createProjectRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
