import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import {
  migrateMotionWorkspaceSnapshot,
  type MotionWorkspaceDescriptor,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import {
  createMotionWorkspaceAlreadyExistsError,
  createMotionWorkspaceNotFoundError,
  createMotionWorkspaceRevisionConflictError,
  type MotionWorkspaceRepository,
  type MotionWorkspaceRepositoryCreateInput,
  type MotionWorkspaceRepositoryOptions,
  type MotionWorkspaceRepositorySaveInput,
} from "./repository.js";

interface DatabaseSyncInstance {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  close(): void;
}

interface RawWorkspaceRow {
  readonly id: string;
  readonly title: string;
  readonly revision: number;
  readonly saved_at: string;
  readonly workspace_json: string;
}

type RawWorkspaceListRow = Pick<RawWorkspaceRow, "id" | "title" | "revision" | "saved_at">;

const SQLITE_TIMESTAMP_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
export const DEFAULT_MOTION_WORKSPACE_SQLITE_PATH = resolve(
  process.cwd(),
  ".qa-sdk",
  "motion-workspace.sqlite",
);

const WORKSPACE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS motion_workspaces (
  id             TEXT NOT NULL PRIMARY KEY,
  title          TEXT NOT NULL,
  revision       INTEGER NOT NULL,
  saved_at       TEXT NOT NULL,
  workspace_json TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (${SQLITE_TIMESTAMP_SQL}),
  updated_at     TEXT NOT NULL DEFAULT (${SQLITE_TIMESTAMP_SQL})
);
CREATE INDEX IF NOT EXISTS idx_motion_workspaces_saved_at
  ON motion_workspaces (saved_at DESC, id ASC);
`;

function createDatabase(path: string): DatabaseSyncInstance {
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string) => DatabaseSyncInstance;
  };
  return new DatabaseSync(path);
}

function resolveSqliteRepositoryPath(path?: string): string {
  if (!path || path.trim().length === 0) {
    return DEFAULT_MOTION_WORKSPACE_SQLITE_PATH;
  }
  return resolve(path);
}

function ensureSqliteDirectory(path: string): void {
  if (path === ":memory:") {
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
}

function readChangeCount(result: unknown): number {
  if (typeof result === "number") {
    return result;
  }
  if (typeof result === "bigint") {
    return Number(result);
  }
  if (typeof result !== "object" || result === null) {
    return 0;
  }

  const changes = (result as { changes?: unknown }).changes;
  if (typeof changes === "number") {
    return changes;
  }
  if (typeof changes === "bigint") {
    return Number(changes);
  }
  return 0;
}

function isSqliteConstraintError(error: unknown): boolean {
  return error instanceof Error
    && /UNIQUE constraint failed/i.test(error.message);
}

function toWorkspaceDescriptor(row: RawWorkspaceListRow): MotionWorkspaceDescriptor {
  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
    savedAt: row.saved_at,
  };
}

function toPersistedWorkspace(row: RawWorkspaceRow): MotionWorkspaceSnapshotV1 {
  return migrateMotionWorkspaceSnapshot(row.workspace_json, {
    expectedRevision: row.revision,
  });
}

function normalizeWorkspace(
  workspace: MotionWorkspaceSnapshotV1,
): MotionWorkspaceSnapshotV1 {
  return migrateMotionWorkspaceSnapshot(workspace);
}

export interface MotionWorkspaceSqliteRepositoryOptions
  extends MotionWorkspaceRepositoryOptions
{}

export class SqliteMotionWorkspaceRepository implements MotionWorkspaceRepository {
  private readonly db: DatabaseSyncInstance;
  readonly path: string;

  constructor(options: MotionWorkspaceSqliteRepositoryOptions = {}) {
    this.path = resolveSqliteRepositoryPath(options.path);
    ensureSqliteDirectory(this.path);
    this.db = createDatabase(this.path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 3000");
    this.db.exec(WORKSPACE_SCHEMA_DDL);
  }

  async get(id: string): Promise<MotionWorkspaceSnapshotV1 | null> {
    const row = this.db.prepare(
      `SELECT id, title, revision, saved_at, workspace_json
       FROM motion_workspaces
       WHERE id = ?`,
    ).get(id) as RawWorkspaceRow | undefined;

    return row ? toPersistedWorkspace(row) : null;
  }

  async list(): Promise<readonly MotionWorkspaceDescriptor[]> {
    const rows = this.db.prepare(
      `SELECT id, title, revision, saved_at
       FROM motion_workspaces
       ORDER BY saved_at DESC, id ASC`,
    ).all() as RawWorkspaceListRow[];

    return rows.map(toWorkspaceDescriptor);
  }

  async create(
    input: MotionWorkspaceRepositoryCreateInput,
  ): Promise<MotionWorkspaceSnapshotV1> {
    const workspace = normalizeWorkspace(input.workspace);
    const payload = JSON.stringify(workspace);

    try {
      this.db.prepare(
        `INSERT INTO motion_workspaces (
          id,
          title,
          revision,
          saved_at,
          workspace_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ${SQLITE_TIMESTAMP_SQL}, ${SQLITE_TIMESTAMP_SQL})`,
      ).run(
        input.id,
        workspace.document.composition.title,
        workspace.revision,
        workspace.savedAt,
        payload,
      );
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw createMotionWorkspaceAlreadyExistsError(input.id);
      }
      throw error;
    }

    return workspace;
  }

  async save(
    input: MotionWorkspaceRepositorySaveInput,
  ): Promise<MotionWorkspaceSnapshotV1> {
    const workspace = normalizeWorkspace(input.workspace);
    const payload = JSON.stringify(workspace);

    const result = this.db.prepare(
      `UPDATE motion_workspaces
       SET title = ?,
           revision = ?,
           saved_at = ?,
           workspace_json = ?,
           updated_at = ${SQLITE_TIMESTAMP_SQL}
       WHERE id = ?
         AND revision = ?`,
    ).run(
      workspace.document.composition.title,
      workspace.revision,
      workspace.savedAt,
      payload,
      input.id,
      input.expectedRevision,
    );

    if (readChangeCount(result) === 0) {
      const current = this.db.prepare(
        "SELECT revision FROM motion_workspaces WHERE id = ?",
      ).get(input.id) as { revision: number } | undefined;

      if (!current) {
        throw createMotionWorkspaceNotFoundError(input.id);
      }

      throw createMotionWorkspaceRevisionConflictError(
        input.expectedRevision,
        current.revision,
      );
    }

    return workspace;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare(
      "DELETE FROM motion_workspaces WHERE id = ?",
    ).run(id);

    return readChangeCount(result) > 0;
  }

  close(): void {
    this.db.close();
  }
}

export function createSqliteMotionWorkspaceRepository(
  options: MotionWorkspaceSqliteRepositoryOptions = {},
): SqliteMotionWorkspaceRepository {
  return new SqliteMotionWorkspaceRepository(options);
}

export function createMotionWorkspaceRepository(
  options: MotionWorkspaceSqliteRepositoryOptions = {},
): MotionWorkspaceRepository {
  return createSqliteMotionWorkspaceRepository(options);
}
