// @def.boundary ingest-system
// @def.doc authorization-ontology-rls-enforcement

import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { INGEST_READ_BIT, EVENT_READ_BIT } from 'resource-policy-store';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

function setBitHex(pos: number): string {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const bytes = new Array(byteIdx + 1).fill(0);
  bytes[byteIdx] = 1 << bitIdx;
  return bytes.map((b: number) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Plan 15b RLS 정책 매트릭스 — ingest.{key_observations, event_records}.
 *
 * 기존 key-observation.adapter.test.ts 패턴 차용 (drizzle pgSchema 우회):
 * qa_admin 으로 DDL+seed, ingest_app 저권한 연결로 정책 효과 검증.
 *
 * tenant 경계는 prefix_id 의 첫 segment (`<tenant>_<domain>_<action>`) 와
 * app.tenant_id GUC 가 일치해야 통과.
 */
const RESET_TABLES_DDL = `
DROP TABLE IF EXISTS ingest.key_observations CASCADE;
DROP TABLE IF EXISTS ingest.key_observation_prefixes CASCADE;
DROP TABLE IF EXISTS ingest.event_records CASCADE;

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

CREATE TABLE ingest.key_observation_prefixes (
  prefix_id      TEXT NOT NULL,
  version        TEXT NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  PRIMARY KEY (prefix_id, version)
);

CREATE TABLE ingest.event_records (
  log_id                   TEXT PRIMARY KEY,
  trace_id                 TEXT NOT NULL,
  span_id                  TEXT NOT NULL,
  parent_span_id           TEXT,
  timestamp                TEXT NOT NULL,
  record_kind              TEXT NOT NULL,
  event_key                TEXT NOT NULL,
  event_version            TEXT NOT NULL,
  span_name                TEXT,
  start_time               TEXT,
  end_time                 TEXT,
  status_code              TEXT,
  payload_format           TEXT NOT NULL,
  payload_encoding         TEXT NOT NULL,
  payload_masking_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  payload_masked_fields    JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload                  JSONB,
  registry_warning         TEXT,
  address_context          JSONB,
  qa_session_id            TEXT,
  actor_id                 TEXT,
  user_id                  TEXT,
  user_attributes          JSONB,
  created_at               TEXT NOT NULL
);

ALTER TABLE ingest.key_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observation_prefixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest.event_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY ko_admin_bypass ON ingest.key_observations
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY ko_select_policy ON ingest.key_observations
  FOR SELECT
  USING (
    auth.has_bit(30)
    AND split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
    AND current_setting('app.tenant_id', true) IS NOT NULL
    AND current_setting('app.tenant_id', true) <> ''
  );

CREATE POLICY ko_insert_policy ON ingest.key_observations
  FOR INSERT
  WITH CHECK (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
    AND current_setting('app.tenant_id', true) IS NOT NULL
    AND current_setting('app.tenant_id', true) <> ''
  );

CREATE POLICY ko_update_policy ON ingest.key_observations
  FOR UPDATE
  USING (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
  );

CREATE POLICY kop_admin_bypass ON ingest.key_observation_prefixes
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY kop_all_policy ON ingest.key_observation_prefixes
  FOR ALL
  USING (split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true))
  WITH CHECK (split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true));

CREATE POLICY er_admin_bypass ON ingest.event_records
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY er_select_policy ON ingest.event_records
  FOR SELECT
  USING (
    auth.has_bit(31)
    AND (
      actor_id = auth.current_user_id()
      OR user_id = auth.current_user_id()
    )
  );

CREATE POLICY er_insert_policy ON ingest.event_records
  FOR INSERT
  WITH CHECK (
    actor_id IS NULL
    OR actor_id = auth.current_user_id()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON ingest.key_observations          TO ingest_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ingest.key_observation_prefixes  TO ingest_app;
GRANT SELECT, INSERT                 ON ingest.event_records             TO ingest_app;
`;

describe.skipIf(!PG_AVAILABLE)('ingest.* RLS — Plan 15b', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';
  const INGEST_APP_PASSWORD = process.env.QA_TEST_PG_INGEST_APP_PASSWORD ?? '';

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    adminSql = postgres({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      max: 3,
      onnotice: () => {},
    });
    await adminSql.unsafe(RESET_TABLES_DDL);
    appSql = postgres({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: 'ingest_app',
      password: INGEST_APP_PASSWORD,
      max: 3,
      onnotice: () => {},
    });
  });

  afterEach(async () => {
    try {
      await adminSql.unsafe(`DROP TABLE IF EXISTS ingest.key_observations CASCADE`);
      await adminSql.unsafe(`DROP TABLE IF EXISTS ingest.key_observation_prefixes CASCADE`);
      await adminSql.unsafe(`DROP TABLE IF EXISTS ingest.event_records CASCADE`);
    } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  const seedKeyObs = (prefixId: string) =>
    adminSql.unsafe(`
    INSERT INTO ingest.key_observations (prefix_id, version, address, packed_key, first_seen, last_seen)
    VALUES ('${prefixId}', 'v1', 0, '${prefixId}:0', '2026-04-22', '2026-04-22')
  `);

  it('key_observations SELECT — tenant 일치 row 만 가시', async () => {
    await seedKeyObs('acme_user_login'); // tenant=acme
    await seedKeyObs('globex_user_login'); // tenant=globex
    const mask = setBitHex(INGEST_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', 'acme', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT prefix_id FROM ingest.key_observations`;
      expect(rows.length).toBe(1);
      expect(rows[0].prefix_id).toBe('acme_user_login');
    });
  });

  it('key_observations INSERT — tenant 접두 불일치 차단', async () => {
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.tenant_id', 'acme', true)`;
        await tx`INSERT INTO ingest.key_observations (prefix_id, version, address, packed_key, first_seen, last_seen) VALUES ('globex_evil', 'v1', 0, 'x', '2026-04-22', '2026-04-22')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it('key_observations — tenant 미주입 시 default deny', async () => {
    await seedKeyObs('acme_user_login');
    const mask = setBitHex(INGEST_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      // tenant_id 미주입
      const rows = await tx`SELECT * FROM ingest.key_observations`;
      expect(rows.length).toBe(0);
    });
  });

  const seedEvent = (actor: string | null, user: string | null, logId: string) =>
    adminSql.unsafe(`
    INSERT INTO ingest.event_records (log_id, trace_id, span_id, timestamp, record_kind, event_key, event_version, payload_format, payload_encoding, created_at, actor_id, user_id)
    VALUES ('${logId}', 't', 'sp', '2026-04-22', 'event', 'k', 'v1', 'json', 'utf8', '2026-04-22', ${actor === null ? 'NULL' : `'${actor}'`}, ${user === null ? 'NULL' : `'${user}'`})
  `);

  it('event_records SELECT — actor 본인 OR user 본인 일치 row 만 가시', async () => {
    await seedEvent('alice', null, 'l1');
    await seedEvent('bob', null, 'l2');
    await seedEvent(null, 'alice', 'l3');
    const mask = setBitHex(EVENT_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT log_id FROM ingest.event_records ORDER BY log_id`;
      const ids = rows.map((r) => r.log_id);
      expect(ids).toEqual(['l1', 'l3']);
    });
  });

  it('event_records INSERT — actor_id 불일치 차단', async () => {
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', 'alice', true)`;
        await tx`INSERT INTO ingest.event_records (log_id, trace_id, span_id, timestamp, record_kind, event_key, event_version, payload_format, payload_encoding, created_at, actor_id) VALUES ('l-bad', 't', 'sp', '2026-04-22', 'event', 'k', 'v1', 'json', 'utf8', '2026-04-22', 'bob')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it('admin bypass — 모든 ingest row 가시', async () => {
    await seedKeyObs('acme_x');
    await seedKeyObs('globex_y');
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      const rows = await tx`SELECT prefix_id FROM ingest.key_observations ORDER BY prefix_id`;
      expect(rows.length).toBe(2);
    });
  });
});
