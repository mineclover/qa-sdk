// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema (comment slice).
 *
 * 컨벤션: doc_ prefix, snake_case 컬럼.
 * Outbox 는 service-wide `document_outbox_events` 를 공유 (document slice 가 정의).
 */
export const comments = sqliteTable(
  'doc_comments',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    authorId: text('author_id').notNull(),
    parentCommentId: text('parent_comment_id'),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_doc_comments_document').on(t.documentId),
    index('idx_doc_comments_parent').on(t.parentCommentId),
  ],
);

export const SIM_DOC_COMMENT_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS doc_comments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  parent_comment_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_comments_document ON doc_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_comments_parent ON doc_comments(parent_comment_id);
`;
