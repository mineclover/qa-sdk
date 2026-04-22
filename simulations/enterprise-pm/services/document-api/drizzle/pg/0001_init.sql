-- @def.boundary sim-document-api
-- Plan 11c — PG 초기 스키마. SIM_DOC_PG_DDL 복사본.
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
