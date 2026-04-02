/**
 * SQLite PipeGraphStore / PipeSpecStore — drizzle + node:sqlite
 *
 * @qa-sdk/core의 PipeGraphStore/PipeSpecStore 포트를 SQLite로 구현.
 * 저장 위치는 소비자가 결정 (예: ~/.qa-sdk/pipe-store.sqlite)
 *
 * @def.doc pipe-store-sqlite
 */

import type { PipeGraphStore, PipeSpecStore } from "@qa-sdk/core";
import type { PipeGraph, PipeSpec, PipeConnection } from "@qa-sdk/core";
import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { eq, desc, like } from "drizzle-orm";

import { pipeGraphs, pipeSpecs } from "./db/schema.js";

type DrizzleDb = ReturnType<typeof drizzle>;

// ── PipeGraphStore ──────────────────────────────────

export class SqlitePipeGraphStore implements PipeGraphStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;

  constructor(path: string) {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");
    try {
      this.db = drizzle({ client: this.rawDb });
      migrate(this.db, {
        migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
      });
    } catch (err) {
      throw err;
    }
  }

  save(graph: PipeGraph): void {
    const id = `${graph.graphId}:${graph.version}`;
    this.db
      .insert(pipeGraphs)
      .values({
        id,
        graphId: graph.graphId,
        version: graph.version,
        description: graph.description ?? null,
        pipes: JSON.stringify(graph.pipes),
        connections: JSON.stringify(graph.connections),
        entryPipeId: graph.entryPipeId,
        manifestVersion: graph.manifestVersion ?? null,
      })
      .onConflictDoUpdate({
        target: pipeGraphs.id,
        set: {
          description: graph.description ?? null,
          pipes: JSON.stringify(graph.pipes),
          connections: JSON.stringify(graph.connections),
          entryPipeId: graph.entryPipeId,
          manifestVersion: graph.manifestVersion ?? null,
        },
      })
      .run();
  }

  get(graphId: string, version: string): PipeGraph | null {
    const row = this.db
      .select()
      .from(pipeGraphs)
      .where(eq(pipeGraphs.id, `${graphId}:${version}`))
      .get();
    return row ? rowToGraph(row) : null;
  }

  getLatest(graphId: string): PipeGraph | null {
    const row = this.db
      .select()
      .from(pipeGraphs)
      .where(eq(pipeGraphs.graphId, graphId))
      .orderBy(desc(pipeGraphs.version))
      .get();
    return row ? rowToGraph(row) : null;
  }

  listVersions(graphId: string): PipeGraph[] {
    return this.db
      .select()
      .from(pipeGraphs)
      .where(eq(pipeGraphs.graphId, graphId))
      .orderBy(pipeGraphs.version)
      .all()
      .map(rowToGraph);
  }

  listAll(): PipeGraph[] {
    // 각 graphId의 최신 버전만 — subquery로 max version 추출
    const all = this.db.select().from(pipeGraphs).orderBy(desc(pipeGraphs.version)).all();
    const latestMap = new Map<string, typeof all[number]>();
    for (const row of all) {
      if (!latestMap.has(row.graphId)) latestMap.set(row.graphId, row);
    }
    return [...latestMap.values()].map(rowToGraph);
  }

  remove(graphId: string, version: string): boolean {
    const result = this.db
      .delete(pipeGraphs)
      .where(eq(pipeGraphs.id, `${graphId}:${version}`))
      .run();
    return result.changes > 0;
  }

  findByPipeId(pipeId: string): PipeGraph[] {
    // JSON 내 검색 — pipes 컬럼에서 pipeId 포함 여부
    return this.db
      .select()
      .from(pipeGraphs)
      .where(like(pipeGraphs.pipes, `%"pipeId":"${pipeId}"%`))
      .all()
      .map(rowToGraph);
  }

  findByTriggerEvent(eventKey: string): PipeGraph[] {
    return this.db
      .select()
      .from(pipeGraphs)
      .where(like(pipeGraphs.pipes, `%"eventKey":"${eventKey}"%`))
      .all()
      .map(rowToGraph);
  }

  close(): void {
    this.rawDb.close();
  }
}

// ── PipeSpecStore ───────────────────────────────────

export class SqlitePipeSpecStore implements PipeSpecStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;

  constructor(path: string) {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");
    try {
      this.db = drizzle({ client: this.rawDb });
      migrate(this.db, {
        migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
      });
    } catch (err) {
      throw err;
    }
  }

  save(spec: PipeSpec): void {
    const id = `${spec.pipeId}:${spec.version}`;
    this.db
      .insert(pipeSpecs)
      .values({
        id,
        pipeId: spec.pipeId,
        version: spec.version,
        description: spec.description ?? null,
        trigger: JSON.stringify(spec.trigger),
        flow: JSON.stringify(spec.flow),
        produces: spec.produces ? JSON.stringify(spec.produces) : null,
        scope: spec.scope ?? null,
        aspect: spec.aspect ?? null,
      })
      .onConflictDoUpdate({
        target: pipeSpecs.id,
        set: {
          description: spec.description ?? null,
          trigger: JSON.stringify(spec.trigger),
          flow: JSON.stringify(spec.flow),
          produces: spec.produces ? JSON.stringify(spec.produces) : null,
          scope: spec.scope ?? null,
          aspect: spec.aspect ?? null,
        },
      })
      .run();
  }

  get(pipeId: string, version: string): PipeSpec | null {
    const row = this.db
      .select()
      .from(pipeSpecs)
      .where(eq(pipeSpecs.id, `${pipeId}:${version}`))
      .get();
    return row ? rowToSpec(row) : null;
  }

  getLatest(pipeId: string): PipeSpec | null {
    const row = this.db
      .select()
      .from(pipeSpecs)
      .where(eq(pipeSpecs.pipeId, pipeId))
      .orderBy(desc(pipeSpecs.version))
      .get();
    return row ? rowToSpec(row) : null;
  }

  listAll(): PipeSpec[] {
    return this.db.select().from(pipeSpecs).all().map(rowToSpec);
  }

  remove(pipeId: string, version: string): boolean {
    const result = this.db
      .delete(pipeSpecs)
      .where(eq(pipeSpecs.id, `${pipeId}:${version}`))
      .run();
    return result.changes > 0;
  }

  close(): void {
    this.rawDb.close();
  }
}

// ── 변환 헬퍼 ───────────────────────────────────────

type GraphRow = typeof pipeGraphs.$inferSelect;
type SpecRow = typeof pipeSpecs.$inferSelect;

function rowToGraph(row: GraphRow): PipeGraph {
  return {
    graphId: row.graphId,
    version: row.version,
    ...(row.description ? { description: row.description } : {}),
    pipes: JSON.parse(row.pipes) as PipeSpec[],
    connections: JSON.parse(row.connections) as PipeConnection[],
    entryPipeId: row.entryPipeId,
    ...(row.manifestVersion ? { manifestVersion: row.manifestVersion } : {}),
  };
}

function rowToSpec(row: SpecRow): PipeSpec {
  return {
    pipeId: row.pipeId,
    version: row.version,
    ...(row.description ? { description: row.description } : {}),
    trigger: JSON.parse(row.trigger),
    flow: JSON.parse(row.flow),
    ...(row.produces ? { produces: JSON.parse(row.produces) } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.aspect ? { aspect: row.aspect } : {}),
  };
}
