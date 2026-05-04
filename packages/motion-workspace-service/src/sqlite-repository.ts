// @def.boundary motion-workspace-service-spec
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createLogger } from "./lib/logger.js";
import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import type { MotionSceneDef } from "motion-content";
import {
  migrateMotionWorkspaceSnapshot,
  type MotionWorkspaceDescriptor,
  type MotionWorkspaceSnapshotV2,
} from "motion-workspace";
import {
  motionWorkspaces,
  motionWorkspaceScenes,
} from "./db/schema.js";
import {
  createMotionWorkspaceAlreadyExistsError,
  createMotionWorkspaceNotFoundError,
  createMotionWorkspaceRevisionConflictError,
  createMotionWorkspaceSceneNotFoundError,
  createMotionWorkspaceSceneRevisionConflictError,
  type MotionWorkspaceRepository,
  type MotionWorkspaceRepositoryCreateInput,
  type MotionWorkspaceRepositoryOptions,
  type MotionWorkspaceRepositorySaveInput,
} from "./repository.js";

interface PersistedSceneRow {
  readonly sceneId: string;
  readonly position: number;
  readonly revision: number;
  readonly sceneJson: string;
}

const MOTION_COMPOSITION_SCHEMA_V2 = "qa-sdk.motion-composition/v2";

export const DEFAULT_MOTION_WORKSPACE_SQLITE_PATH = resolve(
  process.cwd(),
  ".qa-sdk",
  "motion-workspace.sqlite",
);

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

function isSceneDocument(
  workspace: MotionWorkspaceSnapshotV2,
): workspace is MotionWorkspaceSnapshotV2 & {
  readonly document: MotionWorkspaceSnapshotV2["document"] & {
    readonly schemaVersion: typeof MOTION_COMPOSITION_SCHEMA_V2;
    readonly composition: MotionWorkspaceSnapshotV2["document"] & {
      readonly scenes: readonly MotionSceneDef[];
    };
  };
} {
  return workspace.document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2;
}

/** drizzle select 결과에서 workspace descriptor로 변환 */
function toWorkspaceDescriptor(row: {
  id: string;
  title: string;
  globalRevision: number;
  savedAt: string;
}): MotionWorkspaceDescriptor {
  return {
    id: row.id,
    title: row.title,
    revision: row.globalRevision,
    savedAt: row.savedAt,
  };
}

function toWorkspaceMetadataSnapshot(
  workspace: MotionWorkspaceSnapshotV2,
): MotionWorkspaceSnapshotV2 {
  if (!isSceneDocument(workspace)) {
    return {
      ...workspace,
      sceneRevisions: {},
    };
  }

  return {
    ...workspace,
    document: {
      ...workspace.document,
      composition: {
        ...workspace.document.composition,
        scenes: [],
      },
    },
    sceneRevisions: {},
  };
}

function toSceneRows(
  workspace: MotionWorkspaceSnapshotV2,
): readonly PersistedSceneRow[] {
  if (!isSceneDocument(workspace)) {
    return [];
  }

  return workspace.document.composition.scenes.map((scene, position) => ({
    sceneId: scene.id,
    position,
    revision: workspace.sceneRevisions[scene.id] ?? 0,
    sceneJson: JSON.stringify(scene),
  }));
}

/** drizzle select 결과(camelCase)에서 MotionWorkspaceSnapshotV2로 조립 */
function toPersistedWorkspace(
  row: {
    id: string;
    title: string;
    globalRevision: number;
    savedAt: string;
    workspaceJson: string;
  },
  sceneRows: readonly {
    workspaceId: string;
    sceneId: string;
    position: number;
    revision: number;
    sceneJson: string;
  }[],
): MotionWorkspaceSnapshotV2 {
  const metadataWorkspace = migrateMotionWorkspaceSnapshot(row.workspaceJson, {
    expectedRevision: row.globalRevision,
  });

  if (!isSceneDocument(metadataWorkspace) || sceneRows.length === 0) {
    return {
      ...metadataWorkspace,
      globalRevision: row.globalRevision,
      savedAt: row.savedAt,
    };
  }

  const scenes = sceneRows
    .slice()
    .toSorted((left, right) => left.position - right.position)
    .map((sceneRow) => JSON.parse(sceneRow.sceneJson) as MotionSceneDef);
  const sceneRevisions = Object.fromEntries(
    sceneRows.map((sceneRow) => [sceneRow.sceneId, sceneRow.revision]),
  );

  return migrateMotionWorkspaceSnapshot({
    ...metadataWorkspace,
    globalRevision: row.globalRevision,
    savedAt: row.savedAt,
    document: {
      ...metadataWorkspace.document,
      composition: {
        ...metadataWorkspace.document.composition,
        scenes,
      },
    },
    sceneRevisions,
  });
}

function normalizeWorkspace(
  workspace: MotionWorkspaceSnapshotV2,
): MotionWorkspaceSnapshotV2 {
  return migrateMotionWorkspaceSnapshot(workspace);
}

export interface MotionWorkspaceSqliteRepositoryOptions
  extends MotionWorkspaceRepositoryOptions
{}

export class SqliteMotionWorkspaceRepository implements MotionWorkspaceRepository {
  private readonly logger = createLogger("motion-workspace");
  /** raw DatabaseSync — PRAGMA, 수동 트랜잭션용 */
  private readonly rawDb: DatabaseSyncInstance;
  /** drizzle query builder 인스턴스 (rawDb와 같은 커넥션) */
  private readonly db: NodeSQLiteDatabase;
  readonly path: string;

  constructor(options: MotionWorkspaceSqliteRepositoryOptions = {}) {
    this.path = resolveSqliteRepositoryPath(options.path);
    ensureSqliteDirectory(this.path);
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(this.path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");
    this.rawDb.exec("PRAGMA foreign_keys = ON");
    // drizzle 인스턴스 생성 + 마이그레이션
    try {
      this.db = drizzle({ client: this.rawDb });
      migrate(this.db, {
        migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
      });
    } catch (err) {
      this.logger.error({ err }, "drizzle 마이그레이션 실패");
      throw err;
    }
  }

  /**
   * 수동 트랜잭션. rawDb와 drizzle db가 같은 커넥션을 공유하므로,
   * rawDb.exec("BEGIN IMMEDIATE") 후 this.db 쿼리가 트랜잭션 안에서 실행된다.
   */
  private withTransaction<T>(operation: () => T): T {
    this.rawDb.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.rawDb.exec("COMMIT");
      return result;
    } catch (error) {
      this.rawDb.exec("ROLLBACK");
      throw error;
    }
  }

  private readWorkspaceRow(id: string) {
    return this.db
      .select({
        id: motionWorkspaces.id,
        title: motionWorkspaces.title,
        globalRevision: motionWorkspaces.globalRevision,
        savedAt: motionWorkspaces.savedAt,
        workspaceJson: motionWorkspaces.workspaceJson,
      })
      .from(motionWorkspaces)
      .where(eq(motionWorkspaces.id, id))
      .get();
  }

  private readSceneRows(workspaceId: string) {
    return this.db
      .select({
        workspaceId: motionWorkspaceScenes.workspaceId,
        sceneId: motionWorkspaceScenes.sceneId,
        position: motionWorkspaceScenes.position,
        revision: motionWorkspaceScenes.revision,
        sceneJson: motionWorkspaceScenes.sceneJson,
      })
      .from(motionWorkspaceScenes)
      .where(eq(motionWorkspaceScenes.workspaceId, workspaceId))
      .orderBy(asc(motionWorkspaceScenes.position), asc(motionWorkspaceScenes.sceneId))
      .all();
  }

  private readSceneRow(workspaceId: string, sceneId: string) {
    return this.db
      .select({
        workspaceId: motionWorkspaceScenes.workspaceId,
        sceneId: motionWorkspaceScenes.sceneId,
        position: motionWorkspaceScenes.position,
        revision: motionWorkspaceScenes.revision,
        sceneJson: motionWorkspaceScenes.sceneJson,
      })
      .from(motionWorkspaceScenes)
      .where(
        and(
          eq(motionWorkspaceScenes.workspaceId, workspaceId),
          eq(motionWorkspaceScenes.sceneId, sceneId),
        ),
      )
      .get();
  }

  private insertSceneRows(
    workspaceId: string,
    scenes: readonly PersistedSceneRow[],
    savedAt: string,
  ): void {
    for (const scene of scenes) {
      this.db
        .insert(motionWorkspaceScenes)
        .values({
          workspaceId,
          sceneId: scene.sceneId,
          position: scene.position,
          revision: scene.revision,
          sceneJson: scene.sceneJson,
          savedAt,
        })
        .run();
    }
  }

  async get(id: string): Promise<MotionWorkspaceSnapshotV2 | null> {
    const row = this.readWorkspaceRow(id);
    if (!row) {
      return null;
    }

    return toPersistedWorkspace(row, this.readSceneRows(id));
  }

  async list(): Promise<readonly MotionWorkspaceDescriptor[]> {
    const rows = this.db
      .select({
        id: motionWorkspaces.id,
        title: motionWorkspaces.title,
        globalRevision: motionWorkspaces.globalRevision,
        savedAt: motionWorkspaces.savedAt,
      })
      .from(motionWorkspaces)
      .orderBy(desc(motionWorkspaces.savedAt), asc(motionWorkspaces.id))
      .all();

    return rows.map(toWorkspaceDescriptor);
  }

  async create(
    input: MotionWorkspaceRepositoryCreateInput,
  ): Promise<MotionWorkspaceSnapshotV2> {
    const workspace = normalizeWorkspace(input.workspace);
    const metadataWorkspace = toWorkspaceMetadataSnapshot(workspace);
    const payload = JSON.stringify(metadataWorkspace);

    try {
      this.withTransaction(() => {
        this.db
          .insert(motionWorkspaces)
          .values({
            id: input.id,
            title: workspace.document.composition.title,
            globalRevision: workspace.globalRevision,
            savedAt: workspace.savedAt,
            workspaceJson: payload,
          })
          .run();

        this.insertSceneRows(input.id, toSceneRows(workspace), workspace.savedAt);
      });
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
  ): Promise<MotionWorkspaceSnapshotV2> {
    const workspace = normalizeWorkspace(input.workspace);
    const metadataWorkspace = toWorkspaceMetadataSnapshot(workspace);
    const payload = JSON.stringify(metadataWorkspace);

    this.withTransaction(() => {
      const result = this.db
        .update(motionWorkspaces)
        .set({
          title: workspace.document.composition.title,
          globalRevision: workspace.globalRevision,
          savedAt: workspace.savedAt,
          workspaceJson: payload,
          updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        })
        .where(
          and(
            eq(motionWorkspaces.id, input.id),
            eq(motionWorkspaces.globalRevision, input.expectedRevision),
          ),
        )
        .run();

      if (readChangeCount(result) === 0) {
        const current = this.db
          .select({ globalRevision: motionWorkspaces.globalRevision })
          .from(motionWorkspaces)
          .where(eq(motionWorkspaces.id, input.id))
          .get();

        if (!current) {
          throw createMotionWorkspaceNotFoundError(input.id);
        }

        throw createMotionWorkspaceRevisionConflictError(
          input.expectedRevision,
          current.globalRevision,
        );
      }

      this.db
        .delete(motionWorkspaceScenes)
        .where(eq(motionWorkspaceScenes.workspaceId, input.id))
        .run();
      this.insertSceneRows(input.id, toSceneRows(workspace), workspace.savedAt);
    });

    return workspace;
  }

  async saveScene(
    workspaceId: string,
    sceneId: string,
    sceneData: MotionSceneDef,
    expectedRevision: number,
  ): Promise<MotionWorkspaceSnapshotV2> {
    if (sceneData.id !== sceneId) {
      throw new Error(`scene.id와 sceneId가 일치해야 합니다: ${sceneData.id} !== ${sceneId}`);
    }

    const workspace = this.withTransaction(() => {
      const workspaceRow = this.readWorkspaceRow(workspaceId);
      if (!workspaceRow) {
        throw createMotionWorkspaceNotFoundError(workspaceId);
      }

      const currentScene = this.readSceneRow(workspaceId, sceneId);
      if (!currentScene) {
        throw createMotionWorkspaceSceneNotFoundError(workspaceId, sceneId);
      }

      const result = this.db
        .update(motionWorkspaceScenes)
        .set({
          sceneJson: JSON.stringify(sceneData),
          revision: sql`${motionWorkspaceScenes.revision} + 1`,
          savedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
          updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        })
        .where(
          and(
            eq(motionWorkspaceScenes.workspaceId, workspaceId),
            eq(motionWorkspaceScenes.sceneId, sceneId),
            eq(motionWorkspaceScenes.revision, expectedRevision),
          ),
        )
        .run();

      if (readChangeCount(result) === 0) {
        const latestScene = this.readSceneRow(workspaceId, sceneId);
        if (!latestScene) {
          throw createMotionWorkspaceSceneNotFoundError(workspaceId, sceneId);
        }
        throw createMotionWorkspaceSceneRevisionConflictError(
          sceneId,
          expectedRevision,
          latestScene.revision,
        );
      }

      this.db
        .update(motionWorkspaces)
        .set({
          savedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
          updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        })
        .where(eq(motionWorkspaces.id, workspaceId))
        .run();

      const nextWorkspaceRow = this.readWorkspaceRow(workspaceId);
      if (!nextWorkspaceRow) {
        throw createMotionWorkspaceNotFoundError(workspaceId);
      }

      return toPersistedWorkspace(nextWorkspaceRow, this.readSceneRows(workspaceId));
    });

    return workspace;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db
      .delete(motionWorkspaces)
      .where(eq(motionWorkspaces.id, id))
      .run();

    return readChangeCount(result) > 0;
  }

  close(): void {
    this.rawDb.close();
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
