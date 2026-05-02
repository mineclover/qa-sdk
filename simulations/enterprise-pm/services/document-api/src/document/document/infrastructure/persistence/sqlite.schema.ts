// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (document slice).
 *
 * 컨벤션:
 *   - 테이블명 snake_case, prefix=doc_ (sim 환경 namespace)
 *   - 컬럼명 snake_case
 *   - 시간은 ISO-8601 TEXT
 *
 * Outbox 테이블은 service-wide shared (`document_outbox_events`) — 본 슬라이스가
 * 정의하지 않고, `shared/outbox` 에서 import.
 */
export const documents = sqliteTable(
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
    index("idx_doc_documents_project").on(t.projectId),
    index("idx_doc_documents_owner").on(t.ownerId),
  ],
);

export const SIM_DOC_DOCUMENT_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS doc_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_documents_project ON doc_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_doc_documents_owner ON doc_documents(owner_id);
`;
