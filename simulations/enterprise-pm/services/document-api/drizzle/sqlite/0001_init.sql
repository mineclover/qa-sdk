-- @def.boundary sim-document-api
-- Plan 11c — SQLite 초기 스키마. SIM_DOC_SQLITE_DDL 복사본.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0, owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_proj ON documents(project_id);

CREATE TABLE IF NOT EXISTS document_versions (
  document_id TEXT NOT NULL, version_number INTEGER NOT NULL,
  content_ref TEXT NOT NULL, author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, author_id TEXT NOT NULL,
  parent_comment_id TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cmt_doc ON comments(document_id);
CREATE INDEX IF NOT EXISTS idx_cmt_parent ON comments(parent_comment_id);
