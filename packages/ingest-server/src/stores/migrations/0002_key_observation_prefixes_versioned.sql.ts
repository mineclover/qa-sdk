// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * Migration 0002 — key_observation_prefixes에 version 차원 추가 (P3).
 *
 * coordinate-storage.rule §1.1 P3 — prefix 집계가 version별로 분리.
 * shape 변경 시 통계 혼합 위험 제거.
 *
 * 본 plan은 application-level backfill 우선:
 *   1. KEY_OBSERVATION_PREFIXES_VERSIONED_DDL_NEW 실행 — `key_observation_prefixes__new` 임시 테이블
 *   2. 기존 row를 application-level backfill (parsePackedAddress)로 version 채워 INSERT INTO __new
 *      (단, 기존 row는 version 정보가 없어 version 추론 불가능 → 'v1' 보수 가정 또는 drop)
 *   3. KEY_OBSERVATION_PREFIXES_FINALIZE_MIGRATION 실행
 */

export const KEY_OBSERVATION_PREFIXES_VERSIONED_DDL_NEW = `
CREATE TABLE IF NOT EXISTS key_observation_prefixes__new (
  prefix_id      TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
`;

export const KEY_OBSERVATION_PREFIXES_FINALIZE_MIGRATION = `
DROP TABLE key_observation_prefixes;
ALTER TABLE key_observation_prefixes__new RENAME TO key_observation_prefixes;
`;
