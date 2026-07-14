// @def.boundary persistence-system-root
// @def.doc persistence-system-root

/**
 * SQLite PipeGraphStore / PipeSpecStore — drizzle + node:sqlite
 *
 * @qa-sdk/core의 PipeGraphStore/PipeSpecStore 포트를 SQLite로 구현.
 * createStores(path)로 단일 DB 연결에서 pipe/manifest/data-object store를 생성한다.
 *
 * @def.doc pipe-store-sqlite
 */

import type { PipeGraphStore, PipeSpecStore } from '@qa-sdk/core';
import type { PipeGraph, PipeSpec, PipeConnection } from '@qa-sdk/core';
import { eq, sql } from 'drizzle-orm';

import { createDb, type DrizzleDb } from './db/connection.js';
import { SqliteBindingStore, SqliteLineageValidationStore } from './data-object-store.js';
import { pipeGraphs, pipeSpecs } from './db/schema.js';
import { SqliteManifestRegistry } from './manifest-store.js';

/** 단일 DB에서 여러 store 생성 */
export function createStores(path: string): {
  graphStore: SqlitePipeGraphStore;
  specStore: SqlitePipeSpecStore;
  manifestRegistry: SqliteManifestRegistry;
  bindingStore: SqliteBindingStore;
  lineageValidationStore: SqliteLineageValidationStore;
  close: () => void;
} {
  const { rawDb, db } = createDb(path);
  return {
    graphStore: new SqlitePipeGraphStore(db),
    specStore: new SqlitePipeSpecStore(db),
    manifestRegistry: SqliteManifestRegistry.fromDb(db),
    bindingStore: new SqliteBindingStore(db),
    lineageValidationStore: new SqliteLineageValidationStore(db),
    close: () => rawDb.close(),
  };
}

// ── 버전 정렬 ───────────────────────────────────────

/** semver-aware 문자열 비교 (인메모리 MemoryPipeGraphStore와 동일) */
function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

// ── PipeGraphStore ──────────────────────────────────

export class SqlitePipeGraphStore implements PipeGraphStore {
  private db: DrizzleDb;

  constructor(pathOrDb: string | DrizzleDb) {
    if (typeof pathOrDb === 'string') {
      const { db } = createDb(pathOrDb);
      this.db = db;
    } else {
      this.db = pathOrDb;
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
    const rows = this.db.select().from(pipeGraphs).where(eq(pipeGraphs.graphId, graphId)).all();
    if (rows.length === 0) return null;
    rows.sort((a, b) => compareVersions(b.version, a.version));
    return rowToGraph(rows[0]);
  }

  listVersions(graphId: string): PipeGraph[] {
    const rows = this.db.select().from(pipeGraphs).where(eq(pipeGraphs.graphId, graphId)).all();
    rows.sort((a, b) => compareVersions(a.version, b.version));
    return rows.map(rowToGraph);
  }

  listAll(): PipeGraph[] {
    const all = this.db.select().from(pipeGraphs).all();
    all.sort((a, b) => compareVersions(b.version, a.version));
    const latestMap = new Map<string, (typeof all)[number]>();
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
    // json_each로 pipes 배열 내 pipeId 검색 — 파라미터 바인딩으로 injection 방지
    const rows = this.db
      .select()
      .from(pipeGraphs)
      .where(
        sql`EXISTS (
          SELECT 1 FROM json_each(${pipeGraphs.pipes})
          WHERE json_extract(value, '$.pipeId') = ${pipeId}
        )`,
      )
      .all();
    return rows.map(rowToGraph);
  }

  findByTriggerEvent(eventKey: string): PipeGraph[] {
    const rows = this.db
      .select()
      .from(pipeGraphs)
      .where(
        sql`EXISTS (
          SELECT 1 FROM json_each(${pipeGraphs.pipes})
          WHERE json_extract(value, '$.trigger.eventKey') = ${eventKey}
        )`,
      )
      .all();
    return rows.map(rowToGraph);
  }
}

// ── PipeSpecStore ───────────────────────────────────

export class SqlitePipeSpecStore implements PipeSpecStore {
  private db: DrizzleDb;

  constructor(pathOrDb: string | DrizzleDb) {
    if (typeof pathOrDb === 'string') {
      const { db } = createDb(pathOrDb);
      this.db = db;
    } else {
      this.db = pathOrDb;
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
    const rows = this.db.select().from(pipeSpecs).where(eq(pipeSpecs.pipeId, pipeId)).all();
    if (rows.length === 0) return null;
    rows.sort((a, b) => compareVersions(b.version, a.version));
    return rowToSpec(rows[0]);
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
