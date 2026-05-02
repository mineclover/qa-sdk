// @def.boundary ingest-system
// @def.doc ingest-system

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
import { D1SessionStore } from "../../../stores/d1-session-store.js";
import { D1VerdictStore } from "../../../stores/d1-verdict-store.js";
import { D1GraphStore } from "../../../stores/d1-graph-store.js";
import { D1ScenarioSpecStore } from "../../../stores/d1-scenario-spec-store.js";
import { D1TransmissionStore } from "../../../stores/d1-transmission-store.js";
import { D1DlqStore } from "../../../stores/d1-dlq-store.js";

const migrationsFolder = new URL("../../../../drizzle", import.meta.url).pathname;

// migration에 미포함된 테이블 — DDL 직접 실행
const EXTRA_DDL = `
CREATE TABLE IF NOT EXISTS runtime_graphs (
  trace_id   TEXT PRIMARY KEY,
  graph      TEXT NOT NULL,
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  built_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_specs (
  scenario_id TEXT PRIMARY KEY,
  version     TEXT NOT NULL,
  domain      TEXT NOT NULL,
  description TEXT,
  spec        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scenario_specs_domain ON scenario_specs(domain);
`;

// coordinate-storage.rule §1.1 P1+P3 준수: PK = (prefix_id, version, address) / (prefix_id, version).
const KEY_OBS_DDL = `
CREATE TABLE IF NOT EXISTS key_observations (
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
CREATE INDEX IF NOT EXISTS idx_key_obs_packed ON key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version ON key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);

CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id      TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
`;

function createDb(): D1Db {
  const driver = new NodeSqliteDriver(":memory:", null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  // migration에 미포함된 테이블 — DDL 직접 실행
  const exec = (driver.$client as { exec(sql: string): void }).exec.bind(driver.$client);
  exec(EXTRA_DDL);
  exec(KEY_OBS_DDL);
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

export function createD1SessionStore() {
  const db = createDb();
  return { store: new D1SessionStore(db), cleanup: async () => {} };
}

export function createD1VerdictStore() {
  const db = createDb();
  return { store: new D1VerdictStore(db), cleanup: async () => {} };
}

export function createD1GraphStore() {
  const db = createDb();
  return { store: new D1GraphStore(db), cleanup: async () => {} };
}

export function createD1ScenarioSpecStore() {
  const db = createDb();
  return { store: new D1ScenarioSpecStore(db), cleanup: async () => {} };
}

export function createD1TransmissionStore() {
  const db = createDb();
  return { store: new D1TransmissionStore(db), cleanup: async () => {} };
}

export function createD1DlqStore() {
  const db = createDb();
  return { store: new D1DlqStore(db), cleanup: async () => {} };
}
