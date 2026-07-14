// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { pgSchema, index, text, doublePrecision } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const reports = sim.table('reporting_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  queryDefinition: text('query_definition').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const dailyMetrics = sim.table(
  'reporting_daily_metrics',
  {
    id: text('id').primaryKey(),
    metricKey: text('metric_key').notNull(),
    date: text('date').notNull(),
    value: doublePrecision('value').notNull(),
    dimensions: text('dimensions').notNull(),
    computedAt: text('computed_at').notNull(),
  },
  (t) => [index('idx_sim_dm_key_date').on(t.metricKey, t.date)],
);

export const SIM_REPORTING_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.reporting_reports (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  query_definition TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim.reporting_daily_metrics (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL, date TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL, dimensions TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_dm_key_date ON sim.reporting_daily_metrics(metric_key, date);
`;

export const SIM_REPORTING_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.reporting_daily_metrics CASCADE;
DROP TABLE IF EXISTS sim.reporting_reports CASCADE;

CREATE TABLE sim.reporting_reports (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  query_definition TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE sim.reporting_daily_metrics (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL, date TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL, dimensions TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX idx_sim_dm_key_date ON sim.reporting_daily_metrics(metric_key, date);
`;
