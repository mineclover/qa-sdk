// @def.boundary ingest-system
// @def.doc ingest-system

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import type { RecordInsert } from '@qa-sdk/core';

import { PgRecordStore } from './event-record.adapter.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

/**
 * 테스트 격리 전략:
 *   - drizzle pgSchema("ingest")는 항상 ingest.event_records를 대상으로 함
 *   - 매 테스트마다 테이블만 drop+create (07b와 동일 패턴)
 *   - ingest schema는 init.sql에서 사전 생성
 */
const RESET_TABLE_DDL = `
DROP TABLE IF EXISTS ingest.event_records CASCADE;

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
CREATE INDEX idx_event_records_trace_id_pg         ON ingest.event_records(trace_id);
CREATE INDEX idx_event_records_trace_timestamp_pg  ON ingest.event_records(trace_id, timestamp);
CREATE INDEX idx_event_records_event_key_pg        ON ingest.event_records(event_key);
CREATE INDEX idx_event_records_session_id_pg       ON ingest.event_records(qa_session_id);
`;

describe.skipIf(!PG_AVAILABLE)('PgRecordStore — PG-specific', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;
  let store: PgRecordStore;

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
    await sql.unsafe(RESET_TABLE_DDL);
    store = new PgRecordStore(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS ingest.event_records CASCADE`);
    } finally {
      await sql.end();
    }
  });

  function makeRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
    return {
      logId: `r-${randomBytes(4).toString('hex')}`,
      traceId: 't1',
      spanId: 's1',
      timestamp: new Date('2026-04-22T10:00:00Z'),
      recordKind: 'log',
      eventKey: 'page.view',
      eventVersion: '001',
      payloadFormat: 'json',
      payloadEncoding: 'raw',
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: { page: 'home' },
      ...overrides,
    };
  }

  it('insertBatch + findByTraceId — 기본 동작', async () => {
    await store.insertBatch([
      makeRecord({ logId: 'r1', eventKey: 'page.view' }),
      makeRecord({
        logId: 'r2',
        eventKey: 'cart.add',
        timestamp: new Date('2026-04-22T10:00:01Z'),
      }),
    ]);
    const rows = await store.findByTraceId('t1');
    expect(rows).toHaveLength(2);
    expect(rows[0].eventKey).toBe('page.view');
    expect(rows[0].payload).toEqual({ page: 'home' });
    expect(rows[1].eventKey).toBe('cart.add');
  });

  it('address_context jsonb round-trip', async () => {
    await store.insertBatch([
      makeRecord({
        logId: 'r1',
        addressContext: { version: 'v1', prefix: 'svc', address: '42' },
      }),
    ]);
    const rows = await store.findByTraceId('t1');
    expect(rows[0].addressContext).toEqual({
      version: 'v1',
      prefix: 'svc',
      address: '42',
    });
  });

  it('payload_masked_fields jsonb round-trip', async () => {
    await store.insertBatch([
      makeRecord({
        logId: 'r1',
        payloadMaskingApplied: true,
        payloadMaskedFields: ['email', 'phone'],
      }),
    ]);
    const rows = await store.findByTraceId('t1');
    expect(rows[0].payloadMaskingApplied).toBe(true);
    expect(rows[0].payloadMaskedFields).toEqual(['email', 'phone']);
  });

  it('onConflictDoNothing — duplicate logId 무시', async () => {
    await store.insertBatch([makeRecord({ logId: 'r1', payload: { v: 1 } })]);
    await store.insertBatch([makeRecord({ logId: 'r1', payload: { v: 2 } })]);
    const rows = await store.findByTraceId('t1');
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ v: 1 }); // 첫 insert 보존
  });

  it('findByTraceIdPaginated — cursor tie-breaker (logId)', async () => {
    const sameTs = new Date('2026-04-22T10:00:00Z');
    await store.insertBatch([
      makeRecord({ logId: 'a', timestamp: sameTs }),
      makeRecord({ logId: 'b', timestamp: sameTs }),
      makeRecord({ logId: 'c', timestamp: sameTs }),
    ]);
    const page1 = await store.findByTraceIdPaginated('t1', { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.items.map((r) => r.logId)).toEqual(['a', 'b']);

    const page2 = await store.findByTraceIdPaginated('t1', {
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].logId).toBe('c');
    expect(page2.hasMore).toBe(false);
  });

  it('findByTimeRange — eventKey + 시간 필터', async () => {
    await store.insertBatch([
      makeRecord({
        logId: 'r1',
        eventKey: 'page.view',
        timestamp: new Date('2026-04-22T09:00:00Z'),
      }),
      makeRecord({
        logId: 'r2',
        eventKey: 'page.view',
        timestamp: new Date('2026-04-22T10:00:00Z'),
      }),
      makeRecord({
        logId: 'r3',
        eventKey: 'cart.add',
        timestamp: new Date('2026-04-22T10:00:00Z'),
      }),
    ]);
    const rows = await store.findByTimeRange({
      from: new Date('2026-04-22T09:30:00Z'),
      eventKey: 'page.view',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].logId).toBe('r2');
  });

  it('user_attributes jsonb round-trip', async () => {
    await store.insertBatch([
      makeRecord({
        logId: 'r1',
        userId: 'u1',
        userAttributes: { tier: 'premium', region: 'kr' },
      }),
    ]);
    const rows = await store.findByTraceId('t1');
    expect(rows[0].userId).toBe('u1');
    expect(rows[0].userAttributes).toEqual({
      tier: 'premium',
      region: 'kr',
    });
  });
});
