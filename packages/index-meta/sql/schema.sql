-- index-meta SQL schema
-- SQLite 호환 DDL. D1 / Turso / libsql / better-sqlite3 등 어디서나 동일하게 적용.
-- PostgreSQL 호환: column types and constraint syntax are standard SQL.
-- 중앙 PrefixRegistry(capacity)는 prefix_registry 테이블로 영속화된다.

-- ── prefix_registry ──────────────────────────────────────────────────────────
-- 주소 공간 DAG의 중앙 관리 테이블. 모든 prefix/version의 capacity를 보관.
-- PrefixRegistry 인터페이스의 SQL 구현 기반.

CREATE TABLE IF NOT EXISTS prefix_registry (
  prefix        TEXT    NOT NULL,
  version_id    TEXT    NOT NULL,
  capacity      INTEGER NOT NULL,
  registered_at TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

-- ── prefix_ref ───────────────────────────────────────────────────────────────
-- composite prefix의 dim 참조 목록. refs = 순서 있는 DimRef 배열.
-- parent → child 의존 관계 (DAG).

CREATE TABLE IF NOT EXISTS prefix_ref (
  parent_prefix     TEXT    NOT NULL,
  parent_version_id TEXT    NOT NULL,
  dim_order         INTEGER NOT NULL,  -- 0-based, refs 배열 순서
  ref_prefix        TEXT    NOT NULL,
  ref_version_id    TEXT    NOT NULL,
  ref_capacity      INTEGER NOT NULL,
  PRIMARY KEY (parent_prefix, parent_version_id, dim_order),
  FOREIGN KEY (parent_prefix, parent_version_id)
    REFERENCES prefix_registry(prefix, version_id)
);

-- ── schema_version ────────────────────────────────────────────────────────────
-- 이 DB 인스턴스가 담당하는 prefix의 버전 메타.
-- capacity는 prefix_registry와 동기화된다.

CREATE TABLE IF NOT EXISTS schema_version (
  prefix      TEXT    NOT NULL,
  version_id  TEXT    NOT NULL,
  capacity    INTEGER NOT NULL,
  changelog   TEXT,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

-- ── entry ─────────────────────────────────────────────────────────────────────
-- position(1-based) → value 매핑. append-only.
-- 빈 position은 row 없음 (sparse).
-- 예약 마커("_", "~", "?", "NaN" 등)도 일반 row로 저장된다.

CREATE TABLE IF NOT EXISTS entry (
  prefix      TEXT    NOT NULL,
  version_id  TEXT    NOT NULL,
  position    INTEGER NOT NULL,  -- 1-based, [1, capacity]
  value       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id, position),
  FOREIGN KEY (prefix, version_id)
    REFERENCES schema_version(prefix, version_id)
);

-- position 범위 조회(getEntriesInRange) 최적화
CREATE INDEX IF NOT EXISTS idx_entry_range
  ON entry (prefix, version_id, position);

-- value 역방향 조회(getEntryByValue) 최적화 — address path: label → position
CREATE INDEX IF NOT EXISTS idx_entry_value
  ON entry (prefix, version_id, value);

-- ── entry_flag ────────────────────────────────────────────────────────────────
-- entry 수준 활성화 상태 이력. append-only.
-- 현재 상태 = (prefix, version_id, position) 기준 updatedAt 최신 row.
-- entry 테이블에 status 컬럼을 두지 않는 이유:
--   - entry는 position → value 영구 매핑 (불변)
--   - status는 운영 결정이므로 별도 이력으로 관리

CREATE TABLE IF NOT EXISTS entry_flag (
  prefix      TEXT NOT NULL,
  version_id  TEXT NOT NULL,
  position    INTEGER NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('active', 'inactive')),
  reason      TEXT,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (prefix, version_id, position)
    REFERENCES entry(prefix, version_id, position)
);

CREATE INDEX IF NOT EXISTS idx_entry_flag_lookup
  ON entry_flag (prefix, version_id, position, updated_at DESC);

-- ── address_state_cache ───────────────────────────────────────────────────────
-- composite 주소 공간의 활성화 상태 캐시.
-- dim별 상태 명세(DimStateSpec[])와 precomputed 구간을 저장한다.
-- 재계산이 필요하면 삭제 후 다시 저장 (upsert).
--
-- specs_json    : DimStateSpec[] — 상태 명세 (재계산·감사용)
-- reserved_json : [[from,to],...] — encode/decode 불가
-- inactive_json : [[from,to],...] — decode만 가능, encode 불가
-- open_json     : [[from,to],...] — encode 가능, decode 불가 (headroom)
--
-- state 의미:
--   active   (기본) — encode + decode 모두 허용
--   inactive         — 값 있으나 비활성. decode 허용, encode 불가
--   open             — 빈 headroom. encode 허용, decode 불가 (shouldVerify=true)
--   reserved         — 하드 블록. encode/decode 모두 불가

CREATE TABLE IF NOT EXISTS address_state_cache (
  prefix         TEXT NOT NULL,
  version_id     TEXT NOT NULL,
  specs_json     TEXT NOT NULL,
  reserved_json  TEXT NOT NULL,
  inactive_json  TEXT NOT NULL,
  open_json      TEXT NOT NULL,
  computed_at    TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

-- ── address_range_cache ─────────────────────────────────────────────────────
-- calcAddressRanges 결과의 범용 사전 계산 캐시.
-- 고차원 비연속 OR 조합의 런타임 비용을 빌드 타임 1회로 전환한다.
--
-- 사용 흐름:
--   1. 빌드 타임: calcAddressRanges(shape, constraints) → ranges
--   2. 저장: INSERT INTO address_range_cache
--   3. 런타임: containsAddress(address, ranges) → O(log n)
--
-- label = 캐시 키 (의미 있는 이름: "role=admin", "user_can_access_*" 등)
-- ranges_json = [[from,to],...] — sorted, merged
-- constraints_json = 원본 constraint 패턴 (재계산·디버깅용, nullable)

CREATE TABLE IF NOT EXISTS address_range_cache (
  prefix           TEXT NOT NULL,
  version_id       TEXT NOT NULL,
  label            TEXT NOT NULL,
  ranges_json      TEXT NOT NULL,
  constraints_json TEXT,
  computed_at      TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id, label)
);

-- (prefix, version_id) 기준 일괄 조회/삭제 최적화
CREATE INDEX IF NOT EXISTS idx_range_cache_version
  ON address_range_cache (prefix, version_id);
