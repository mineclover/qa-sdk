// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { pgSchema, primaryKey, index, text, integer } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const documents = sim.table(
  'doc_documents',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    title: text('title').notNull(),
    currentVersion: integer('current_version').notNull().default(0),
    ownerId: text('owner_id').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_sim_doc_proj').on(t.projectId)],
);

export const documentVersions = sim.table(
  'doc_versions',
  {
    documentId: text('document_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    contentRef: text('content_ref').notNull(),
    authorId: text('author_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.versionNumber] })],
);

export const comments = sim.table(
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
    index('idx_sim_cmt_doc').on(t.documentId),
    index('idx_sim_cmt_parent').on(t.parentCommentId),
  ],
);

export const SIM_DOC_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.doc_documents (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0, owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_doc_proj ON sim.doc_documents(project_id);

CREATE TABLE IF NOT EXISTS sim.doc_versions (
  document_id TEXT NOT NULL, version_number INTEGER NOT NULL,
  content_ref TEXT NOT NULL, author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS sim.doc_comments (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, author_id TEXT NOT NULL,
  parent_comment_id TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_cmt_doc ON sim.doc_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_sim_cmt_parent ON sim.doc_comments(parent_comment_id);
`;

export const SIM_DOC_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.doc_versions CASCADE;
DROP TABLE IF EXISTS sim.doc_comments CASCADE;
DROP TABLE IF EXISTS sim.doc_documents CASCADE;

CREATE TABLE sim.doc_documents (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0, owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_sim_doc_proj ON sim.doc_documents(project_id);

CREATE TABLE sim.doc_versions (
  document_id TEXT NOT NULL, version_number INTEGER NOT NULL,
  content_ref TEXT NOT NULL, author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, version_number)
);

CREATE TABLE sim.doc_comments (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, author_id TEXT NOT NULL,
  parent_comment_id TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX idx_sim_cmt_doc ON sim.doc_comments(document_id);
CREATE INDEX idx_sim_cmt_parent ON sim.doc_comments(parent_comment_id);
`;
