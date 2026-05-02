// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (version slice).
 *
 * 테이블 키: (document_id, version_number) 합성 PK (append-only).
 */
export const versions = sqliteTable(
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

export const SIM_DOC_VERSION_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS doc_versions (
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content_ref TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, version_number)
);
`;
