// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PgAuditRecorder } from './adapter.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

/**
 * 테스트 격리 전략:
 *   - drizzle pgSchema("audit")는 항상 audit.audit_entries를 대상으로 함
 *   - 매 테스트마다 audit.audit_entries를 drop+create (RLS 정책 포함)
 *   - qa_admin은 schema 소유주가 아니므로 DROP SCHEMA는 불가, DROP TABLE만 가능
 *   - schema 자체는 init.sql에서 이미 생성됨 (audit schema)
 *
 * 05 시리즈 학습: random schema 대신 DROP/CREATE + fileParallelism:false 패턴.
 */
const RESET_TABLE_DDL = `
DROP TABLE IF EXISTS audit.audit_entries CASCADE;

CREATE TABLE audit.audit_entries (
  span_id           TEXT PRIMARY KEY,
  trace_id          TEXT NOT NULL,
  parent_span_id    TEXT,
  root_span_id      TEXT NOT NULL,
  depth             INTEGER NOT NULL,
  kind              VARCHAR(16) NOT NULL CHECK (kind IN ('execution','check')),
  api_id            TEXT,
  actor_user_id     TEXT,
  actor_tenant_id   TEXT,
  target_kind       TEXT,
  target_id         TEXT,
  outcome           VARCHAR(16) CHECK (outcome IS NULL OR outcome IN ('allow','deny','error')),
  pass              VARCHAR(16) CHECK (pass IS NULL OR pass IN ('bitmap','lifecycle','cerbos','acl')),
  address           INTEGER,
  union_kind        TEXT,
  deny_reason       TEXT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  metadata          JSONB
);
CREATE INDEX idx_audit_trace_pg  ON audit.audit_entries(trace_id);
CREATE INDEX idx_audit_root_pg   ON audit.audit_entries(root_span_id);
CREATE INDEX idx_audit_parent_pg ON audit.audit_entries(parent_span_id);
CREATE INDEX idx_audit_actor_pg  ON audit.audit_entries(actor_user_id, started_at);
CREATE INDEX idx_audit_target_pg ON audit.audit_entries(target_kind, target_id);

ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ae_temp_allow_all ON audit.audit_entries
  USING (true)
  WITH CHECK (true);
`;

describe.skipIf(!PG_AVAILABLE)('PgAuditRecorder — PG-specific', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;
  let recorder: PgAuditRecorder;

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
    recorder = new PgAuditRecorder(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS audit.audit_entries CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it('startExecution + get — root execution 트리 invariant 유지', async () => {
    const e = await recorder.startExecution({
      spanId: 'root',
      traceId: 't1',
      parentSpanId: null,
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'transaction',
      targetId: 'tx-A',
    });
    expect(e.rootSpanId).toBe('root');
    expect(e.depth).toBe(0);
    const got = await recorder.get('root');
    expect(got?.kind).toBe('execution');
  });

  it('metadata는 jsonb로 저장·복원 (string parse 없음)', async () => {
    await recorder.startExecution({
      spanId: 'e',
      traceId: 't',
      parentSpanId: null,
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'resource',
      targetId: 'r',
      metadata: { source: 'http', reqId: 'abc-123', nested: { count: 7 } },
    });
    const got = await recorder.get('e');
    expect(got?.metadata).toEqual({ source: 'http', reqId: 'abc-123', nested: { count: 7 } });

    // raw 컬럼이 jsonb인지 확인 — text가 아닌 object 비교가 가능
    const raw = await sql<{ metadata: unknown }[]>`
      SELECT metadata FROM audit.audit_entries WHERE span_id = 'e'
    `;
    expect(typeof raw[0].metadata).toBe('object');
  });

  it('CHECK constraint — invalid kind 거절', async () => {
    await expect(
      sql`INSERT INTO audit.audit_entries
          (span_id, trace_id, root_span_id, depth, kind, started_at)
          VALUES ('bad', 't', 'bad', 0, 'INVALID_KIND', '2026-04-22')`,
    ).rejects.toThrow();
  });

  it('CHECK constraint — invalid outcome 거절', async () => {
    await expect(
      sql`INSERT INTO audit.audit_entries
          (span_id, trace_id, root_span_id, depth, kind, outcome, started_at)
          VALUES ('bad', 't', 'bad', 0, 'execution', 'INVALID_OUTCOME', '2026-04-22')`,
    ).rejects.toThrow();
  });

  it('RLS placeholder 정책이 임시 통과 (ae_temp_allow_all) — INSERT/SELECT 양쪽', async () => {
    // RLS는 enabled이지만 임시 정책으로 모두 통과해야 함
    await recorder.startExecution({
      spanId: 'rls-test',
      traceId: 't',
      parentSpanId: null,
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'resource',
      targetId: 'r',
    });
    const got = await recorder.get('rls-test');
    expect(got).not.toBeNull();
  });

  it('listByRoot — depth asc, startedAt asc 정렬 (PG 인덱스 사용)', async () => {
    const t0 = '2026-04-22T10:00:00.000Z';
    const t1 = '2026-04-22T10:00:01.000Z';
    const t2 = '2026-04-22T10:00:02.000Z';
    await recorder.startExecution({
      spanId: 'r',
      traceId: 't',
      parentSpanId: null,
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'transaction',
      targetId: 'A',
      now: t0,
    });
    await recorder.startExecution({
      spanId: 'c1',
      traceId: 't',
      parentSpanId: 'r',
      apiId: 'B',
      actorUserId: 'u',
      targetKind: 'resource',
      targetId: 'r1',
      now: t1,
    });
    await recorder.recordCheck({
      spanId: 'chk',
      traceId: 't',
      parentSpanId: 'c1',
      pass: 'bitmap',
      outcome: 'allow',
      now: t2,
    });
    const list = await recorder.listByRoot('r');
    expect(list.map((e) => e.spanId)).toEqual(['r', 'c1', 'chk']);
    expect(list.map((e) => e.depth)).toEqual([0, 1, 2]);
  });

  it('write-mostly 모델 — finishExecution UPDATE 동작 (audit_writer role 가정)', async () => {
    // 본 테스트는 qa_admin으로 실행되므로 UPDATE 통과 — 실 운영에서는 audit_writer role 필요
    await recorder.startExecution({
      spanId: 'e',
      traceId: 't',
      parentSpanId: null,
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'resource',
      targetId: 'r',
    });
    const done = await recorder.finishExecution('e', 'allow', '2026-04-22T10:05:00Z');
    expect(done.outcome).toBe('allow');
    expect(done.endedAt).toBe('2026-04-22T10:05:00Z');
  });
});
