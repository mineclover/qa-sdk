import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const testScenarios = sqliteTable(
  "test_scenarios",
  {
    id: text("id").primaryKey(),
    aCoord: text("a_coord").notNull().unique(),
    specAddress: text("spec_address").notNull(),
    kind: text("kind").notNull(),
    scope: text("scope").notNull().default("single"),
    phase: text("phase"),
    lifecycle: text("lifecycle").notNull().default("declared"),
    intent: text("intent").notNull(),
    primarySvc: text("primary_svc").notNull(),
    participants: text("participants").notNull().default("[]"),
    filePath: text("file_path"),
    simulationRef: text("simulation_ref"),
    specVersion: text("spec_version"),
    conventionViolation: integer("convention_violation", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_ts_spec").on(table.specAddress),
    index("idx_ts_kind").on(table.kind),
    index("idx_ts_lifecycle").on(table.lifecycle),
  ],
);

export const testScenarioRuns = sqliteTable(
  "test_scenario_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scenarioId: text("scenario_id").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    commitHash: text("commit_hash"),
    durationMs: integer("duration_ms"),
    runAt: text("run_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_tsr_scenario").on(table.scenarioId),
    index("idx_tsr_run_at").on(table.runAt),
  ],
);
