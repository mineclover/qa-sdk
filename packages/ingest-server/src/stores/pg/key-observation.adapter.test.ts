// @def.boundary ingest-system
// @def.doc ingest-system

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PgKeyObservationStore } from './key-observation.adapter.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

/**
 * 테스트 격리 전략 (05 시리즈 PgResourcePolicyRegistry 동일 패턴):
 *   - drizzle pgSchema("ingest")는 항상 ingest.* 를 대상으로 함
 *   - 매 테스트마다 ingest.{key_observations,key_observation_prefixes}를 drop+create
 *   - schema 자체는 init.sql에서 이미 생성됨 (qa_sdk_test DB)
 *   - DDL은 KEY_OBSERVATIONS_PG_DDL과 일치하되 schema CREATE는 생략
 */
const RESET_TABLES_DDL = `
DROP TABLE IF EXISTS ingest.key_observations CASCADE;
DROP TABLE IF EXISTS ingest.key_observation_prefixes CASCADE;

CREATE TABLE ingest.key_observations (
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
CREATE INDEX idx_key_obs_packed_pg          ON ingest.key_observations(packed_key);
CREATE INDEX idx_key_obs_prefix_version_pg  ON ingest.key_observations(prefix_id, version);
CREATE INDEX idx_key_obs_last_seen_pg       ON ingest.key_observations(last_seen);
CREATE INDEX idx_key_obs_count_pg           ON ingest.key_observations(count);
CREATE INDEX idx_key_obs_registered_pg      ON ingest.key_observations(registered);

CREATE TABLE ingest.key_observation_prefixes (
  prefix_id      TEXT NOT NULL,
  version        TEXT NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
`;

describe.skipIf(!PG_AVAILABLE)('PgKeyObservationStore — PG-specific', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;
  let store: PgKeyObservationStore;

  beforeEach(async () => {
    sql = postgres({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      max: 5,
      onnotice: () => {},
    });
    await sql.unsafe(RESET_TABLES_DDL);
    store = new PgKeyObservationStore(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(
        `DROP TABLE IF EXISTS ingest.key_observations CASCADE;
         DROP TABLE IF EXISTS ingest.key_observation_prefixes CASCADE;`,
      );
    } finally {
      await sql.end();
    }
  });

  it('observe → packed_key parse → version/address 분리 저장', async () => {
    await store.observe({
      packedKey: 'svc:v1:42',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const rows = await store.findByPrefix('svc');
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe('v1');
    expect(rows[0].address).toBe(42);
  });

  it('같은 prefix·다른 version은 별도 row (PG composite PK)', async () => {
    await store.observe({
      packedKey: 'svc:v1:5',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    await store.observe({
      packedKey: 'svc:v2:5',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:01Z',
    });
    const rows = await store.findByPrefix('svc');
    expect(rows).toHaveLength(2);
    const versions = new Set(rows.map((r) => r.version));
    expect(versions).toEqual(new Set(['v1', 'v2']));
  });

  it('payload_summary jsonb round-trip', async () => {
    await store.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
      payloadFields: ['page', 'userId'],
      samplePayload: { page: 'home', userId: 'u1' },
    });
    const rows = await store.findByPrefix('svc');
    expect(rows[0].payloadSummary.fieldFrequency.page).toBe(1);
    expect(rows[0].payloadSummary.sampleValues.userId).toBe('u1');
  });

  it('prefixSummary는 (prefix_id, version)별 분리', async () => {
    await store.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    await store.observe({
      packedKey: 'svc:v2:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:01Z',
    });
    const summaries = await store.prefixSummary('svc');
    expect(summaries).toHaveLength(2);
    const versions = new Set(summaries.map((s) => s.version));
    expect(versions).toEqual(new Set(['v1', 'v2']));
  });

  it('findUnregistered — registered=FALSE 비교 (PG boolean)', async () => {
    await store.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: false,
      timestamp: '2026-04-22T10:00:00Z',
    });
    await store.observe({
      packedKey: 'svc:v1:2',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const unreg = await store.findUnregistered();
    expect(unreg).toHaveLength(1);
    expect(unreg[0].address).toBe(1);
  });
});
