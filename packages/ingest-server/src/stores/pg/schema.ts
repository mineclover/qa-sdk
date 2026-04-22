// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ingest schema 안의 key_observations + key_observation_prefixes (Plan 07b).
 *
 * §4 (coord-storage-audit) P1·P3 결과를 PG로 이식:
 *   - PK = (prefix_id, version, address)
 *   - packed_key는 secondary index (역호환·이력 추적)
 *   - prefix 집계도 (prefix_id, version) 복합 PK
 *
 * SQLite 버전(`packages/ingest-server/src/db/schema.ts` keyObservations)과 동일 구조,
 * dialect 차이만:
 *   - integer → integer (그대로)
 *   - text → text (그대로)
 *   - boolean SQLite는 INTEGER(0/1), PG는 native boolean
 *   - JSON payload_summary는 PG에서 jsonb (성능)
 *   - timestamp 필드는 ISO-8601 text 유지 (ingest 핫패스 호환성)
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

const ingestSchema = pgSchema("ingest");

export const keyObservations = ingestSchema.table(
  "key_observations",
  {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    address: integer("address").notNull(),
    packedKey: text("packed_key").notNull(),
    registered: boolean("registered").notNull().default(false),
    count: integer("count").notNull().default(1),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
    payloadSummary: jsonb("payload_summary").notNull().default({}),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version, t.address] }),
    index("idx_key_obs_packed_pg").on(t.packedKey),
    index("idx_key_obs_prefix_version_pg").on(t.prefixId, t.version),
    index("idx_key_obs_last_seen_pg").on(t.lastSeen),
    index("idx_key_obs_count_pg").on(t.count),
    index("idx_key_obs_registered_pg").on(t.registered),
  ],
);

export const keyObservationPrefixes = ingestSchema.table(
  "key_observation_prefixes",
  {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    distinctKeys: integer("distinct_keys").notNull().default(1),
    totalCount: integer("total_count").notNull().default(0),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
  },
  (t) => [primaryKey({ columns: [t.prefixId, t.version] })],
);

export type KeyObservationPgRow = typeof keyObservations.$inferSelect;
export type KeyObservationPrefixPgRow =
  typeof keyObservationPrefixes.$inferSelect;

/**
 * raw DDL — Drizzle Kit 마이그레이션 정착 전까지 fixture/migration용.
 * §4 P1~P3 패턴 PG 이식.
 */
export const KEY_OBSERVATIONS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS ingest;

CREATE TABLE IF NOT EXISTS ingest.key_observations (
  prefix_id        TEXT NOT NULL,
  version          TEXT NOT NULL,
  address          INTEGER NOT NULL,
  packed_key       TEXT NOT NULL,
  registered       BOOLEAN NOT NULL DEFAULT FALSE,
  count            INTEGER NOT NULL DEFAULT 1,
  first_seen       TEXT NOT NULL,
  last_seen        TEXT NOT NULL,
  payload_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (prefix_id, version, address)
);
CREATE INDEX IF NOT EXISTS idx_key_obs_packed_pg          ON ingest.key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version_pg  ON ingest.key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen_pg       ON ingest.key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count_pg           ON ingest.key_observations(count);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered_pg      ON ingest.key_observations(registered);

CREATE TABLE IF NOT EXISTS ingest.key_observation_prefixes (
  prefix_id      TEXT NOT NULL,
  version        TEXT NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
`;
