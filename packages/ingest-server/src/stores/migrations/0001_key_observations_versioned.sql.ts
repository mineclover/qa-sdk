// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * Migration 0001 — key_observations에 version/address 구조화 컬럼 추가.
 *
 * 본 plan은 application-level backfill 우선 (REVERSE 의존 회피).
 * SQL 마이그레이션은 새 table 생성/INSERT SELECT/RENAME 패턴만 담당.
 * parsePackedAddress는 코드에서 호출하여 새 컬럼에 채운다.
 *
 * 사용 흐름:
 *   1. KEY_OBSERVATIONS_VERSIONED_DDL_NEW 실행 — `key_observations__new` 임시 테이블 생성
 *   2. 기존 row를 application-level backfill (parsePackedAddress) → INSERT INTO __new
 *   3. KEY_OBSERVATIONS_FINALIZE_MIGRATION 실행 — 기존 drop + rename + 인덱스
 */

export const KEY_OBSERVATIONS_VERSIONED_DDL_NEW = `
CREATE TABLE IF NOT EXISTS key_observations__new (
  prefix_id       TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  address         INTEGER NOT NULL,
  packed_key      TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}',
  PRIMARY KEY (prefix_id, version, address)
);
`;

export const KEY_OBSERVATIONS_FINALIZE_MIGRATION = `
DROP TABLE key_observations;
ALTER TABLE key_observations__new RENAME TO key_observations;
CREATE INDEX IF NOT EXISTS idx_key_obs_packed ON key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version ON key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);
`;
