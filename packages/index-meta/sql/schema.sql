-- index-meta SQL schema
-- SQLite 호환 DDL. D1 / Turso / libsql / better-sqlite3 등 어디서나 동일하게 적용.
-- 중앙 PrefixRegistry(capacity)는 별도 KV/중앙 DB에서 관리한다.

-- ── schema_version ─────────────────────────────────────────────────────────
-- 이 DB 인스턴스가 담당하는 prefix의 버전 메타.
-- capacity는 중앙 PrefixRegistry와 동기화된다.

CREATE TABLE IF NOT EXISTS schema_version (
  table_id   TEXT    NOT NULL,
  version_id TEXT    NOT NULL,
  capacity   INTEGER NOT NULL,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (table_id, version_id)
);

-- ── entry ───────────────────────────────────────────────────────────────────
-- position(1-based) → value 매핑.
-- 빈 position은 row 없음 (sparse).
-- 예약 마커("_", "~", "?", "NaN" 등)도 일반 row로 저장된다.

CREATE TABLE IF NOT EXISTS entry (
  table_id   TEXT    NOT NULL,
  version_id TEXT    NOT NULL,
  position   INTEGER NOT NULL,  -- 1-based, [1, capacity]
  value      TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (table_id, version_id, position)
);

-- position 범위 조회(getEntriesInRange) 최적화
CREATE INDEX IF NOT EXISTS idx_entry_range
  ON entry (table_id, version_id, position);

-- ── address_state_cache ──────────────────────────────────────────────────────
-- 1D 주소 공간의 활성화 상태 캐시.
-- dim별 상태 명세(DimStateSpec[])와 precomputed 구간을 저장한다.
-- 재계산이 필요하면 삭제 후 다시 저장 (upsert).
--
-- specs_json         : DimStateSpec[] (JSON) — 상태 명세 (재계산·감사용)
-- reserved_json      : [[from,to],...] — reserved 주소 구간 (encode/decode 불가)
-- inactive_json      : [[from,to],...] — inactive 주소 구간 (decode만 가능)
--
-- state 의미:
--   active   (기본) — encode + decode 모두 허용
--   inactive         — 값 있으나 비활성. decode 허용, encode 불가
--   reserved         — 공간만 있고 값 없음. encode/decode 모두 불가

CREATE TABLE IF NOT EXISTS address_state_cache (
  prefix         TEXT NOT NULL,
  version_id     TEXT NOT NULL,
  specs_json     TEXT NOT NULL,
  reserved_json  TEXT NOT NULL,
  inactive_json  TEXT NOT NULL,
  computed_at    TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id)
);
