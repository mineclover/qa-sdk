// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const qualityGateRuns = sqliteTable(
  "quality_gate_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gateDocId: text("gate_doc_id").notNull(),
    docVersion: integer("doc_version").notNull(),
    bundleId: text("bundle_id"),
    command: text("command").notNull(),
    outcome: text("outcome").notNull(),
    exitCode: integer("exit_code"),
    executedAt: text("executed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    notes: text("notes"),
    repoRoot: text("repo_root"),
    gitBranch: text("git_branch"),
    gitSha: text("git_sha"),
    runDurationMs: integer("run_duration_ms"),
    successPattern: text("success_pattern"),
    successPatternMatched: integer("success_pattern_matched", { mode: "boolean" }),
    failureClass: text("failure_class"),
  },
  (table) => [
    index("idx_qgr_gate").on(table.gateDocId),
    index("idx_qgr_bundle").on(table.bundleId),
    index("idx_qgr_executed").on(table.executedAt),
    index("idx_qgr_git_sha").on(table.gitSha),
  ],
);
