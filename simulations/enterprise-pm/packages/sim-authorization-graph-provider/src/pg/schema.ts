// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import { index, pgSchema, text } from 'drizzle-orm/pg-core';

const simSchema = pgSchema('sim');

export const authorizationGraphSnapshots = simSchema.table(
  'authorization_graph_snapshots',
  {
    snapshotId: text('snapshot_id').primaryKey(),
    graphId: text('graph_id').notNull(),
    graphJson: text('graph_json').notNull(),
    createdAt: text('created_at').notNull(),
    sourceRef: text('source_ref'),
    tagsJson: text('tags_json'),
    labelsJson: text('labels_json'),
    metadataJson: text('metadata_json'),
    auditReportJson: text('audit_report_json'),
  },
  (table) => [
    index('idx_sim_authz_graph_snapshots_graph_id').on(table.graphId),
    index('idx_sim_authz_graph_snapshots_created_at').on(table.createdAt),
  ],
);

export type PgAuthorizationGraphRow = typeof authorizationGraphSnapshots.$inferSelect;

export const AUTHORIZATION_GRAPH_SNAPSHOTS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;
CREATE TABLE IF NOT EXISTS sim.authorization_graph_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_ref TEXT,
  tags_json TEXT,
  labels_json TEXT,
  metadata_json TEXT,
  audit_report_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_sim_authz_graph_snapshots_graph_id
  ON sim.authorization_graph_snapshots (graph_id);
CREATE INDEX IF NOT EXISTS idx_sim_authz_graph_snapshots_created_at
  ON sim.authorization_graph_snapshots (created_at);
`;
