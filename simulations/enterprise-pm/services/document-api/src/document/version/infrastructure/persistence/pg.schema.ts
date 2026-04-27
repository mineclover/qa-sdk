// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { pgSchema, text, integer, primaryKey } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const versions = sim.table(
  "doc_versions",
  {
    documentId: text("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    contentRef: text("content_ref").notNull(),
    authorId: text("author_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.versionNumber] })],
);

export const SIM_DOC_VERSION_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.doc_versions (
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content_ref TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, version_number)
);
`;
