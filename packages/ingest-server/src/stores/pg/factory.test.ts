// @def.boundary ingest-system
// @def.doc ingest-system

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';

import { createPgIngestStores, type PgIngestStoreSet } from './factory.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

const SETUP_DDL = `
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
`;

const CLEANUP_DDL = `
DROP TABLE IF EXISTS ingest.key_observations CASCADE;
DROP TABLE IF EXISTS ingest.key_observation_prefixes CASCADE;
DROP TABLE IF EXISTS ingest.event_records CASCADE;
`;

describe.skipIf(!PG_AVAILABLE)('createPgIngestStores', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';
  const PG_URL = `postgres://${PG_USER}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;

  let stores: PgIngestStoreSet | undefined;

  beforeEach(async () => {
    const setup = postgres(PG_URL, { max: 2, onnotice: () => {} });
    try {
      await setup.unsafe(SETUP_DDL);
    } finally {
      await setup.end();
    }
  });

  afterEach(async () => {
    if (stores) {
      try {
        await stores.close();
      } catch {
        // idempotent close
      }
      stores = undefined;
    }
    const cleanup = postgres(PG_URL, { max: 2, onnotice: () => {} });
    try {
      await cleanup.unsafe(CLEANUP_DDL);
    } finally {
      await cleanup.end();
    }
  });

  it('두 어댑터 인스턴스 + close 반환', async () => {
    stores = await createPgIngestStores({ url: PG_URL, schema: 'ingest' });
    expect(stores.recordStore).toBeDefined();
    expect(stores.keyObservationStore).toBeDefined();
    expect(typeof stores.close).toBe('function');
  });

  it('search_path 설정 — 어댑터 round-trip 동작', async () => {
    stores = await createPgIngestStores({ url: PG_URL, schema: 'ingest' });
    await stores.keyObservationStore.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const rows = await stores.keyObservationStore.findByPrefix('svc');
    expect(rows).toHaveLength(1);
  });

  it('close 후 재호출 안전', async () => {
    stores = await createPgIngestStores({ url: PG_URL, schema: 'ingest' });
    await stores.close();
    // double close: postgres-js는 graceful.
    await expect(stores.close()).resolves.not.toThrow();
    stores = undefined;
  });

  it("기본 schema는 'ingest'", async () => {
    stores = await createPgIngestStores({ url: PG_URL });
    // default schema 설정 검증 — 실제 SET search_path가 수행됐음을 observe round-trip으로 확인.
    await stores.keyObservationStore.observe({
      packedKey: 'svc:v1:99',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const rows = await stores.keyObservationStore.findByPrefix('svc');
    expect(rows).toHaveLength(1);
  });
});
