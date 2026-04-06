/**
 * D1 (SQLite) 팩토리 — NodeSqliteDriver(:memory:) 기반.
 * 각 호출마다 독립적인 in-memory DB를 생성한다.
 */
import { NodeSqliteDriver } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { createD1Drizzle, type D1Db } from "../../../stores/d1-db-type.js";
import { D1RecordStore } from "../../../stores/d1-record-store.js";
import { D1TraceStore } from "../../../stores/d1-trace-store.js";
import { D1KeyObservationStore } from "../../../stores/d1-key-observation-store.js";

const migrationsFolder = new URL("../../../../drizzle", import.meta.url).pathname;

// key_observations 테이블은 migration에 미포함 — DDL 직접 실행
const KEY_OBS_DDL = `
CREATE TABLE IF NOT EXISTS key_observations (
  packed_key      TEXT    NOT NULL PRIMARY KEY,
  prefix_id       TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix ON key_observations(prefix_id);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);

CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id      TEXT    NOT NULL PRIMARY KEY,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL
);
`;

function createDb(): D1Db {
  const driver = new NodeSqliteDriver(":memory:", null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  // migration에 key_observations 미포함 — DDL 직접 실행
  (driver.$client as { exec(sql: string): void }).exec(KEY_OBS_DDL);
  return createD1Drizzle(driver.$client);
}

export function createD1RecordStore() {
  const db = createDb();
  return { store: new D1RecordStore(db), cleanup: async () => {} };
}

export function createD1TraceStore() {
  const db = createDb();
  return { store: new D1TraceStore(db), cleanup: async () => {} };
}

export function createD1KeyObservationStore() {
  const db = createDb();
  return { store: new D1KeyObservationStore(db), cleanup: async () => {} };
}
