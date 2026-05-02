// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { pgSchema, text, integer, index } from "drizzle-orm/pg-core";

/**
 * Postgres schema (document slice).
 */
const sim = pgSchema("sim");

export const documents = sim.table(
  "doc_documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    currentVersion: integer("current_version").notNull().default(0),
    ownerId: text("owner_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_sim_doc_documents_project").on(t.projectId),
    index("idx_sim_doc_documents_owner").on(t.ownerId),
  ],
);

export const SIM_DOC_DOCUMENT_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.doc_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_doc_documents_project ON sim.doc_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_sim_doc_documents_owner ON sim.doc_documents(owner_id);
`;
