import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { eq, and } from "drizzle-orm";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { testScenarios, testScenarioRuns } from "./db/schema.js";
import type {
  TestScenario,
  TestScenarioRun,
  CreateTestScenarioInput,
  TestLifecycle,
} from "./types.js";

type DrizzleDb = ReturnType<typeof drizzle>;

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export class SqliteTestScenarioStore {
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

  upsertDeclared(input: CreateTestScenarioInput): void {
    const existing = this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.aCoord, input.aCoord))
      .get();

    if (existing) return;

    this.db.insert(testScenarios).values({
      id: input.aCoord,
      aCoord: input.aCoord,
      specAddress: input.specAddress,
      kind: input.kind,
      scope: input.scope ?? "single",
      lifecycle: "declared",
      intent: input.intent,
      primarySvc: input.primarySvc,
      participants: JSON.stringify(input.participants ?? []),
    }).run();
  }

  assign(aCoord: string, bCoord: string, filePath: string, violation: boolean): void {
    this.db
      .update(testScenarios)
      .set({
        id: bCoord,
        lifecycle: "assigned",
        filePath,
        conventionViolation: violation,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(testScenarios.aCoord, aCoord))
      .run();
  }

  recordRun(scenarioId: string, passed: boolean, commitHash: string | null, durationMs: number | null): void {
    this.db.insert(testScenarioRuns).values({
      scenarioId,
      passed,
      commitHash,
      durationMs,
    }).run();

    const scenario = this.getById(scenarioId);
    if (scenario && scenario.lifecycle === "assigned") {
      this.db
        .update(testScenarios)
        .set({ lifecycle: "collected", updatedAt: new Date().toISOString() })
        .where(eq(testScenarios.id, scenarioId))
        .run();
    }
  }

  getByACoord(aCoord: string): TestScenario | undefined {
    const row = this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.aCoord, aCoord))
      .get();
    return row ? this.rowToScenario(row) : undefined;
  }

  getById(id: string): TestScenario | undefined {
    const row = this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.id, id))
      .get();
    return row ? this.rowToScenario(row) : undefined;
  }

  listAll(): TestScenario[] {
    return this.db.select().from(testScenarios).all().map(r => this.rowToScenario(r));
  }

  listByLifecycle(lifecycle: TestLifecycle): TestScenario[] {
    return this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.lifecycle, lifecycle))
      .all()
      .map(r => this.rowToScenario(r));
  }

  nextSeq(kind: string, scope: string): number {
    const count = this.db
      .select()
      .from(testScenarios)
      .where(and(eq(testScenarios.kind, kind), eq(testScenarios.scope, scope)))
      .all().length;
    return count + 1;
  }

  private rowToScenario(row: typeof testScenarios.$inferSelect): TestScenario {
    return {
      id: row.id,
      aCoord: row.aCoord,
      specAddress: row.specAddress,
      kind: row.kind as TestScenario["kind"],
      scope: row.scope as TestScenario["scope"],
      lifecycle: row.lifecycle as TestScenario["lifecycle"],
      intent: row.intent,
      primarySvc: row.primarySvc,
      participants: JSON.parse(row.participants),
      filePath: row.filePath,
      simulationRef: row.simulationRef,
      specVersion: row.specVersion,
      conventionViolation: row.conventionViolation,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
