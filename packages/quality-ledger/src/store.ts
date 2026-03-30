import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { eq, desc, inArray } from "drizzle-orm";
import { resolve } from "node:path";
import { qualityGateRuns } from "./db/schema.js";
import type { GateFailureClass, GateRunEntry, GateRunOutcome } from "./types.js";

type DrizzleDb = ReturnType<typeof drizzle>;

export class SqliteQualityStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;

  constructor(path: string = ":memory:") {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");

    this.db = drizzle({ client: this.rawDb });
    migrate(this.db, {
      migrationsFolder: resolve(__dirname, "../drizzle"),
    });
  }

  insert(entry: {
    gateDocId: string;
    docVersion: number;
    bundleId?: string | null;
    command: string;
    outcome: GateRunOutcome;
    exitCode?: number | null;
    executedAt: string;
    notes?: string | null;
    repoRoot?: string | null;
    gitBranch?: string | null;
    gitSha?: string | null;
    runDurationMs?: number | null;
    successPattern?: string | null;
    successPatternMatched?: boolean | null;
    failureClass?: GateFailureClass | null;
  }): void {
    this.db
      .insert(qualityGateRuns)
      .values({
        gateDocId: entry.gateDocId,
        docVersion: entry.docVersion,
        bundleId: entry.bundleId ?? null,
        command: entry.command,
        outcome: entry.outcome,
        exitCode: entry.exitCode ?? null,
        executedAt: entry.executedAt,
        notes: entry.notes ?? null,
        repoRoot: entry.repoRoot ?? null,
        gitBranch: entry.gitBranch ?? null,
        gitSha: entry.gitSha ?? null,
        runDurationMs: entry.runDurationMs ?? null,
        successPattern: entry.successPattern ?? null,
        successPatternMatched: entry.successPatternMatched ?? null,
        failureClass: entry.failureClass ?? null,
      })
      .run();
  }

  getLatestByGate(gateDocId: string): GateRunEntry | null {
    const row = this.db
      .select()
      .from(qualityGateRuns)
      .where(eq(qualityGateRuns.gateDocId, gateDocId))
      .orderBy(desc(qualityGateRuns.id))
      .limit(1)
      .get();
    return row ? this.toEntry(row) : null;
  }

  getLatestByGates(gateDocIds: string[]): Map<string, GateRunEntry> {
    if (gateDocIds.length === 0) return new Map();

    const rows = this.db
      .select()
      .from(qualityGateRuns)
      .where(inArray(qualityGateRuns.gateDocId, gateDocIds))
      .orderBy(desc(qualityGateRuns.id))
      .all();

    const result = new Map<string, GateRunEntry>();
    for (const row of rows) {
      if (!result.has(row.gateDocId)) {
        result.set(row.gateDocId, this.toEntry(row));
      }
    }
    return result;
  }

  history(gateDocId: string, limit = 20): GateRunEntry[] {
    const rows = this.db
      .select()
      .from(qualityGateRuns)
      .where(eq(qualityGateRuns.gateDocId, gateDocId))
      .orderBy(desc(qualityGateRuns.id))
      .limit(limit)
      .all();
    return rows.map((row) => this.toEntry(row));
  }

  close(): void {
    this.rawDb.close();
  }

  private toEntry(row: typeof qualityGateRuns.$inferSelect): GateRunEntry {
    return {
      id: row.id,
      gateDocId: row.gateDocId,
      docVersion: row.docVersion,
      bundleId: row.bundleId,
      command: row.command,
      outcome: row.outcome as GateRunOutcome,
      exitCode: row.exitCode,
      executedAt: row.executedAt,
      notes: row.notes,
      repoRoot: row.repoRoot,
      gitBranch: row.gitBranch,
      gitSha: row.gitSha,
      runDurationMs: row.runDurationMs,
      successPattern: row.successPattern,
      successPatternMatched: row.successPatternMatched,
      failureClass: row.failureClass as GateFailureClass | null,
    };
  }
}
