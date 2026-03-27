/**
 * definition-service DDL — SQLite 테이블 정의
 *
 * 7개 테이블:
 *   prefix_registry       — prefix 정의 (DEMO_CATALOG에서 seed)
 *   documents             — 문서 메타데이터 (최신 버전)
 *   document_history      — 문서 버전 이력 (body 포함)
 *   slice_intents         — 주소 슬라이스 의도
 *   consumption_snapshots — 주소 소비율 스냅샷
 *   test_registry         — 문서 ↔ 테스트 매핑
 *   test_results          — 테스트 실행 결과 시계열
 */
export const DEFINITION_SERVICE_DDL = `
CREATE TABLE IF NOT EXISTS prefix_registry (
  prefix_id     TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  labels_json   TEXT NOT NULL DEFAULT '[]',
  dims_json     TEXT NOT NULL DEFAULT '{}',
  versions_json TEXT NOT NULL DEFAULT '[]',
  meta_json     TEXT NOT NULL DEFAULT '{}',
  dep_prefix_ids TEXT NOT NULL DEFAULT '[]',
  version       INTEGER NOT NULL DEFAULT 1,
  registered_at TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pr_category ON prefix_registry(category);

CREATE TABLE IF NOT EXISTS documents (
  doc_id      TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  aspect      TEXT NOT NULL,
  depth       TEXT NOT NULL,
  lifecycle   TEXT NOT NULL,
  layer       TEXT,
  tags_json   TEXT NOT NULL DEFAULT '[]',
  links_json  TEXT NOT NULL DEFAULT '[]',
  svc         TEXT,
  address     TEXT,
  version     INTEGER NOT NULL DEFAULT 1,
  body_hash   TEXT NOT NULL,
  purpose     TEXT,
  intent      TEXT,
  context     TEXT,
  caveat      TEXT,
  synced_at   TEXT NOT NULL,
  source_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_doc_scope ON documents(scope, aspect);
CREATE INDEX IF NOT EXISTS idx_doc_lifecycle ON documents(lifecycle);

CREATE TABLE IF NOT EXISTS document_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      TEXT NOT NULL,
  version     INTEGER NOT NULL,
  scope       TEXT NOT NULL,
  aspect      TEXT NOT NULL,
  depth       TEXT NOT NULL,
  lifecycle   TEXT NOT NULL,
  layer       TEXT,
  tags_json   TEXT NOT NULL,
  links_json  TEXT NOT NULL,
  body_hash   TEXT NOT NULL,
  body        TEXT NOT NULL,
  purpose     TEXT,
  intent      TEXT,
  context     TEXT,
  caveat      TEXT,
  change_type TEXT NOT NULL,
  synced_at   TEXT NOT NULL,
  UNIQUE(doc_id, version)
);
CREATE INDEX IF NOT EXISTS idx_dh_doc ON document_history(doc_id, version DESC);

CREATE TABLE IF NOT EXISTS slice_intents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prefix_id   TEXT NOT NULL,
  slice_json  TEXT NOT NULL,
  slice_depth INTEGER NOT NULL,
  intent      TEXT NOT NULL,
  observation_goal TEXT,
  owner       TEXT,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_si_prefix ON slice_intents(prefix_id);

CREATE TABLE IF NOT EXISTS consumption_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  prefix_id           TEXT NOT NULL,
  prefix_version      TEXT NOT NULL,
  collected_at        TEXT NOT NULL,
  total_space         INTEGER NOT NULL,
  observed_addresses  INTEGER NOT NULL,
  consumption_rate    REAL NOT NULL,
  dim_stats_json      TEXT NOT NULL,
  severity            TEXT
);
CREATE INDEX IF NOT EXISTS idx_cs_prefix ON consumption_snapshots(prefix_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS test_registry (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      TEXT NOT NULL,
  test_file   TEXT NOT NULL,
  suite       TEXT,
  description TEXT,
  layer       TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(doc_id, test_file, suite)
);
CREATE INDEX IF NOT EXISTS idx_tr_doc ON test_registry(doc_id);
CREATE INDEX IF NOT EXISTS idx_tr_file ON test_registry(test_file);

CREATE TABLE IF NOT EXISTS test_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      TEXT NOT NULL,
  test_file   TEXT NOT NULL,
  suite       TEXT,
  passed      INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_summary TEXT,
  run_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tres_doc ON test_results(doc_id, run_at DESC);
`;
