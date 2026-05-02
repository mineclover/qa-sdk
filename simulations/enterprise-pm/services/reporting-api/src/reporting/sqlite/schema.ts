// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  queryDefinition: text("query_definition").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyMetrics = sqliteTable("daily_metrics", {
  id: text("id").primaryKey(),
  metricKey: text("metric_key").notNull(),
  date: text("date").notNull(),
  value: real("value").notNull(),
  dimensions: text("dimensions").notNull(),
  computedAt: text("computed_at").notNull(),
}, (t) => [index("idx_dm_key_date").on(t.metricKey, t.date)]);

export const SIM_REPORTING_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  query_definition TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL, date TEXT NOT NULL,
  value REAL NOT NULL, dimensions TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm_key_date ON daily_metrics(metric_key, date);
`;
