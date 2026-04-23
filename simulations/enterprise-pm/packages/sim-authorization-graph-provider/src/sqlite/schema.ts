// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const authorizationGraphSnapshots = sqliteTable(
  "authorization_graph_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    graphId: text("graph_id").notNull(),
    graphJson: text("graph_json").notNull(),
    createdAt: text("created_at").notNull(),
    sourceRef: text("source_ref"),
    tagsJson: text("tags_json"),
    labelsJson: text("labels_json"),
    metadataJson: text("metadata_json"),
    auditReportJson: text("audit_report_json"),
  },
  (table) => [
    index("idx_authz_graph_snapshots_graph_id").on(table.graphId),
    index("idx_authz_graph_snapshots_created_at").on(table.createdAt),
  ],
);

export type SqliteAuthorizationGraphRow = typeof authorizationGraphSnapshots.$inferSelect;

export const AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS authorization_graph_snapshots (
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
CREATE INDEX IF NOT EXISTS idx_authz_graph_snapshots_graph_id
  ON authorization_graph_snapshots (graph_id);
CREATE INDEX IF NOT EXISTS idx_authz_graph_snapshots_created_at
  ON authorization_graph_snapshots (created_at);
`;
