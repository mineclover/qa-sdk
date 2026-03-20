/**
 * DKG State Store — SQLite 스키마.
 *
 * DKG 노드/엣지 + UsageData 스냅샷 + VersionUsage 히스토리를 영속화.
 * ~/.qa-sdk/state.sqlite 에 저장.
 */

export const DKG_SCHEMA_DDL = `
-- ═══════════════════════════════════════════════════════
--  DKG 노드
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dkg_nodes (
  id        TEXT    NOT NULL PRIMARY KEY,
  kind      TEXT    NOT NULL,
  data      TEXT    NOT NULL,  -- JSON
  created_at TEXT   NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT   NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dkg_nodes_kind ON dkg_nodes (kind);

-- ═══════════════════════════════════════════════════════
--  DKG 엣지
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dkg_edges (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT    NOT NULL,
  from_id    TEXT    NOT NULL,
  to_id      TEXT    NOT NULL,
  meta       TEXT,  -- JSON (nullable)
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dkg_edges_from ON dkg_edges (from_id, type);
CREATE INDEX IF NOT EXISTS idx_dkg_edges_to ON dkg_edges (to_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dkg_edges_unique ON dkg_edges (type, from_id, to_id);

-- ═══════════════════════════════════════════════════════
--  UsageData 스냅샷 — 집계 결과 영속화
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  collected_at TEXT    NOT NULL DEFAULT (datetime('now')),
  period_from  TEXT    NOT NULL,
  period_to    TEXT    NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  data         TEXT    NOT NULL  -- JSON (full UsageData)
);

-- ═══════════════════════════════════════════════════════
--  VersionUsage 히스토리 — 배포 스큐 추적
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS version_usages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id  INTEGER NOT NULL REFERENCES usage_snapshots(id),
  prefix       TEXT    NOT NULL,
  version      TEXT    NOT NULL,
  count        INTEGER NOT NULL,
  last_seen    TEXT    NOT NULL,
  sessions     TEXT    NOT NULL  -- JSON array
);

CREATE INDEX IF NOT EXISTS idx_version_usages_prefix ON version_usages (prefix, version);
CREATE INDEX IF NOT EXISTS idx_version_usages_snapshot ON version_usages (snapshot_id);

-- ═══════════════════════════════════════════════════════
--  메타데이터
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dkg_meta (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);
`;
