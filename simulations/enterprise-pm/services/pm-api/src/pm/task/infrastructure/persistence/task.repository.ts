// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { TaskEntity } from "../../domain/index.js";
import type { TaskSnapshot } from "../../domain/index.js";
import { TaskRepositoryPort } from "../../application/ports/task-repository.port.js";
import type { TaskTransactionScope } from "../../application/ports/task-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface TaskRow {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string | null;
  status: "todo" | "in_progress" | "done" | "blocked";
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: TaskRow): TaskSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    assigneeId: row.assigneeId ?? null,
    status: row.status,
    parentTaskId: row.parentTaskId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(snapshot: TaskSnapshot): TaskRow {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    title: snapshot.title,
    assigneeId: snapshot.assigneeId,
    status: snapshot.status,
    parentTaskId: snapshot.parentTaskId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

export class SqliteTaskRepository extends TaskRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: TaskEntity, _scope: TaskTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.tasks)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.tasks.id,
        set: {
          projectId: row.projectId,
          title: row.title,
          assigneeId: row.assigneeId,
          status: row.status,
          parentTaskId: row.parentTaskId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<TaskEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.tasks)
      .where(eq(sqliteSchema.tasks.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return TaskEntity.rehydrate(toSnapshot(rows[0] as TaskRow));
  }

  async listByProject(projectId: string): Promise<TaskEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.tasks)
      .where(eq(sqliteSchema.tasks.projectId, projectId));
    return rows.map((row) => TaskEntity.rehydrate(toSnapshot(row as TaskRow)));
  }

  async listSubtasks(parentTaskId: string): Promise<TaskEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.tasks)
      .where(eq(sqliteSchema.tasks.parentTaskId, parentTaskId));
    return rows.map((row) => TaskEntity.rehydrate(toSnapshot(row as TaskRow)));
  }

  async delete(id: string, _scope: TaskTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.tasks).where(eq(sqliteSchema.tasks.id, id));
  }
}

export class PgTaskRepository extends TaskRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: TaskEntity, _scope: TaskTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.tasks)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.tasks.id,
        set: {
          projectId: row.projectId,
          title: row.title,
          assigneeId: row.assigneeId,
          status: row.status,
          parentTaskId: row.parentTaskId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<TaskEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.tasks)
      .where(eq(pgSchema.tasks.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return TaskEntity.rehydrate(toSnapshot(rows[0] as TaskRow));
  }

  async listByProject(projectId: string): Promise<TaskEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.tasks)
      .where(eq(pgSchema.tasks.projectId, projectId));
    return rows.map((row) => TaskEntity.rehydrate(toSnapshot(row as TaskRow)));
  }

  async listSubtasks(parentTaskId: string): Promise<TaskEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.tasks)
      .where(eq(pgSchema.tasks.parentTaskId, parentTaskId));
    return rows.map((row) => TaskEntity.rehydrate(toSnapshot(row as TaskRow)));
  }

  async delete(id: string, _scope: TaskTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.tasks).where(eq(pgSchema.tasks.id, id));
  }
}

export type TaskDialect = "sqlite" | "pg";

export interface TaskRepositoryFactoryOpts {
  readonly dialect: TaskDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createTaskRepository(
  opts: TaskRepositoryFactoryOpts,
): TaskRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteTaskRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgTaskRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(`createTaskRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
