// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const comments = sim.table(
  "doc_comments",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    authorId: text("author_id").notNull(),
    parentCommentId: text("parent_comment_id"),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_sim_doc_comments_document").on(t.documentId),
    index("idx_sim_doc_comments_parent").on(t.parentCommentId),
  ],
);

export const SIM_DOC_COMMENT_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.doc_comments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  parent_comment_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_doc_comments_document ON sim.doc_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_sim_doc_comments_parent ON sim.doc_comments(parent_comment_id);
`;
