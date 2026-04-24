// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import {
  auditAuthorizationGraph,
  type AuthorizationGraphAuditOptions,
  type AuthorizationGraphSnapshotListFilter,
  type AuthorizationGraphSnapshotRecord,
  type AuthorizationGraphStore,
  type AuthorizationOntologyGraph,
  type SaveAuthorizationGraphSnapshotInput,
} from "authorization-ontology";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { authorizationGraphSnapshots as sqliteTable } from "./sqlite/schema.js";
import { authorizationGraphSnapshots as pgTable } from "./pg/schema.js";
import {
  AUTHORIZATION_GRAPH_SNAPSHOTS_PG_DDL,
  type PgAuthorizationGraphRow,
} from "./pg/schema.js";
import {
  AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL,
  type SqliteAuthorizationGraphRow,
} from "./sqlite/schema.js";

export interface CreateSimAuthorizationGraphStoreArgs {
  dialect: "sqlite" | "pg";
  db: unknown;
  applyDdl?: boolean;
}

export interface PruneAuthorizationGraphSnapshotsArgs {
  graphId: string;
  keepLatest: number;
}

export interface PruneAuthorizationGraphSnapshotsResult {
  graphId: string;
  beforeCount: number;
  afterCount: number;
  deletedSnapshotIds: string[];
  keptSnapshotIds: string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSnapshotId(graphId: string, createdAt: string, sequence: number): string {
  const safeGraphId = graphId.replace(/[^a-zA-Z0-9_.:-]/g, "_");
  return `${safeGraphId}:${createdAt}:${sequence}`;
}

function matchesFilter(
  record: AuthorizationGraphSnapshotRecord,
  filter: AuthorizationGraphSnapshotListFilter,
): boolean {
  if (filter.graphId && record.graphId !== filter.graphId) return false;
  if (filter.sourceRef && record.sourceRef !== filter.sourceRef) return false;
  if (filter.tag && !(record.tags ?? []).includes(filter.tag)) return false;
  if (filter.createdAfter && record.createdAt <= filter.createdAfter) return false;
  if (filter.createdBefore && record.createdAt >= filter.createdBefore) return false;
  for (const [key, value] of Object.entries(filter.labels ?? {})) {
    if (record.labels?.[key] !== value) return false;
  }
  return true;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

function toRecord(
  row: Pick<
    SqliteAuthorizationGraphRow | PgAuthorizationGraphRow,
    | "snapshotId"
    | "graphId"
    | "graphJson"
    | "createdAt"
    | "sourceRef"
    | "tagsJson"
    | "labelsJson"
    | "metadataJson"
    | "auditReportJson"
  >,
): AuthorizationGraphSnapshotRecord {
  return {
    snapshotId: row.snapshotId,
    graphId: row.graphId,
    graph: parseJson<AuthorizationOntologyGraph>(row.graphJson, {
      realms: [],
      nodes: [],
      relations: [],
    }),
    createdAt: row.createdAt,
    sourceRef: row.sourceRef ?? undefined,
    tags: parseJson<string[] | undefined>(row.tagsJson, undefined),
    labels: parseJson<Record<string, string> | undefined>(row.labelsJson, undefined),
    metadata: parseJson<Record<string, unknown> | undefined>(row.metadataJson, undefined),
    auditReport: parseJson(row.auditReportJson, undefined),
  };
}

function toRow(input: SaveAuthorizationGraphSnapshotInput & {
  snapshotId: string;
  graphId: string;
  createdAt: string;
  auditReport?: ReturnType<typeof auditAuthorizationGraph>;
}) {
  return {
    snapshotId: input.snapshotId,
    graphId: input.graphId,
    graphJson: JSON.stringify(clone(input.graph)),
    createdAt: input.createdAt,
    sourceRef: input.sourceRef ?? null,
    tagsJson: input.tags ? JSON.stringify([...input.tags]) : null,
    labelsJson: input.labels ? JSON.stringify({ ...input.labels }) : null,
    metadataJson: input.metadata ? JSON.stringify(clone(input.metadata)) : null,
    auditReportJson: input.auditReport ? JSON.stringify(clone(input.auditReport)) : null,
  };
}

class SqliteAuthorizationGraphStore implements AuthorizationGraphStore {
  private sequence = 0;

  constructor(private readonly db: BetterSQLite3Database) {}

  async saveSnapshot(
    input: SaveAuthorizationGraphSnapshotInput,
  ): Promise<AuthorizationGraphSnapshotRecord> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const graphId = input.graphId ?? "authorization-graph";
    const snapshotId = input.snapshotId ?? createSnapshotId(graphId, createdAt, this.sequence++);
    const auditReport = input.audit ? auditAuthorizationGraph(input.graph, input.auditOptions) : undefined;
    const row = toRow({
      ...input,
      graphId,
      snapshotId,
      createdAt,
      auditReport,
    });
    this.db.insert(sqliteTable).values(row).run();
    return toRecord(row);
  }

  async getSnapshot(snapshotId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    const rows = this.db
      .select()
      .from(sqliteTable)
      .where(eq(sqliteTable.snapshotId, snapshotId))
      .limit(1)
      .all();
    return rows.length === 0 ? null : toRecord(rows[0]);
  }

  async listSnapshots(
    filter: AuthorizationGraphSnapshotListFilter = {},
  ): Promise<AuthorizationGraphSnapshotRecord[]> {
    const rows = this.db
      .select()
      .from(sqliteTable)
      .orderBy(asc(sqliteTable.createdAt))
      .all();
    const records = rows.map(toRecord).filter((record) => matchesFilter(record, filter));
    return clone(filter.limit ? records.slice(0, filter.limit) : records);
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const result = this.db
      .delete(sqliteTable)
      .where(eq(sqliteTable.snapshotId, snapshotId))
      .run();
    return result.changes > 0;
  }
}

class PgAuthorizationGraphStore implements AuthorizationGraphStore {
  private sequence = 0;

  constructor(private readonly db: PostgresJsDatabase) {}

  async saveSnapshot(
    input: SaveAuthorizationGraphSnapshotInput,
  ): Promise<AuthorizationGraphSnapshotRecord> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const graphId = input.graphId ?? "authorization-graph";
    const snapshotId = input.snapshotId ?? createSnapshotId(graphId, createdAt, this.sequence++);
    const auditReport = input.audit ? auditAuthorizationGraph(input.graph, input.auditOptions) : undefined;
    const row = toRow({
      ...input,
      graphId,
      snapshotId,
      createdAt,
      auditReport,
    });
    await this.db.insert(pgTable).values(row);
    return toRecord(row);
  }

  async getSnapshot(snapshotId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    const rows = await this.db
      .select()
      .from(pgTable)
      .where(eq(pgTable.snapshotId, snapshotId))
      .limit(1);
    return rows.length === 0 ? null : toRecord(rows[0]);
  }

  async listSnapshots(
    filter: AuthorizationGraphSnapshotListFilter = {},
  ): Promise<AuthorizationGraphSnapshotRecord[]> {
    const rows = await this.db
      .select()
      .from(pgTable)
      .orderBy(asc(pgTable.createdAt));
    const records = rows.map(toRecord).filter((record) => matchesFilter(record, filter));
    return clone(filter.limit ? records.slice(0, filter.limit) : records);
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const rows = await this.db
      .delete(pgTable)
      .where(eq(pgTable.snapshotId, snapshotId))
      .returning({ snapshotId: pgTable.snapshotId });
    return rows.length > 0;
  }
}

export async function createSimAuthorizationGraphStore(
  args: CreateSimAuthorizationGraphStoreArgs,
): Promise<AuthorizationGraphStore> {
  if (args.db === null || args.db === undefined) {
    throw new Error("createSimAuthorizationGraphStore: db instance required (no fallback)");
  }

  const applyDdl = args.applyDdl ?? true;

  if (args.dialect === "sqlite") {
    if (applyDdl) {
      const raw = (args.db as BetterSQLite3Database as unknown as {
        $client: { exec: (sql: string) => void };
      }).$client;
      raw.exec(AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL);
    }
    return new SqliteAuthorizationGraphStore(args.db as BetterSQLite3Database);
  }

  if (args.dialect === "pg") {
    if (applyDdl) {
      const raw = (args.db as PostgresJsDatabase as unknown as {
        $client: { unsafe: (sql: string) => Promise<unknown> };
      }).$client;
      await raw.unsafe(AUTHORIZATION_GRAPH_SNAPSHOTS_PG_DDL);
    }
    return new PgAuthorizationGraphStore(args.db as PostgresJsDatabase);
  }

  throw new Error(`createSimAuthorizationGraphStore: unsupported dialect=${String((args as { dialect?: string }).dialect)}`);
}

export async function pruneAuthorizationGraphSnapshots(
  store: AuthorizationGraphStore,
  args: PruneAuthorizationGraphSnapshotsArgs,
): Promise<PruneAuthorizationGraphSnapshotsResult> {
  const keepLatest = Math.max(0, Math.trunc(args.keepLatest));
  const snapshots = await store.listSnapshots({ graphId: args.graphId });
  const sorted = [...snapshots].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const kept = keepLatest === 0 ? [] : sorted.slice(-keepLatest);
  const deleted = keepLatest === 0 ? sorted : sorted.slice(0, Math.max(0, sorted.length - keepLatest));

  for (const snapshot of deleted) {
    await store.deleteSnapshot(snapshot.snapshotId);
  }

  return {
    graphId: args.graphId,
    beforeCount: sorted.length,
    afterCount: kept.length,
    deletedSnapshotIds: deleted.map((snapshot) => snapshot.snapshotId),
    keptSnapshotIds: kept.map((snapshot) => snapshot.snapshotId),
  };
}
