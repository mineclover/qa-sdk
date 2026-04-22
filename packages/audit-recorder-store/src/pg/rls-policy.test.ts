// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AUDIT_READ_BIT } from "resource-policy-store";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

function setBitHex(pos: number): string {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const bytes = new Array(byteIdx + 1).fill(0);
  bytes[byteIdx] = 1 << bitIdx;
  return bytes.map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Plan 15b RLS 정책 매트릭스 — audit.audit_entries.
 *
 * 기존 adapter.test.ts 패턴 차용 (drizzle pgSchema("audit") 하드코딩 우회).
 * qa_admin 으로 DDL+seed, audit_app 저권한 연결로 정책 효과 검증.
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

ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ae_admin_bypass ON audit.audit_entries
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY ae_select_policy ON audit.audit_entries
  FOR SELECT
  USING (
    auth.has_bit(20)
    AND actor_user_id = auth.current_user_id()
  );

CREATE POLICY ae_insert_policy ON audit.audit_entries
  FOR INSERT
  WITH CHECK (
    actor_user_id IS NULL
    OR actor_user_id = auth.current_user_id()
  );

-- audit_app 에 SELECT/INSERT 명시적 부여 (write-mostly: UPDATE/DELETE 금지)
GRANT SELECT, INSERT ON audit.audit_entries TO audit_app;
`;

describe.skipIf(!PG_AVAILABLE)("audit.audit_entries RLS — Plan 15b", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";
  const AUDIT_APP_PASSWORD = process.env.QA_TEST_PG_AUDIT_APP_PASSWORD ?? "";

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    adminSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: PG_USER, password: PG_PASSWORD, max: 3, onnotice: () => {},
    });
    await adminSql.unsafe(RESET_TABLE_DDL);
    appSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: "audit_app", password: AUDIT_APP_PASSWORD, max: 3, onnotice: () => {},
    });
  });

  afterEach(async () => {
    try {
      await adminSql.unsafe(`DROP TABLE IF EXISTS audit.audit_entries CASCADE`);
    } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  const seedEntry = (actor: string | null) => adminSql.unsafe(`
    INSERT INTO audit.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at)
    VALUES ('span-${actor ?? "null"}', 'trace-1', 'span-${actor ?? "null"}', 0, 'execution', ${actor === null ? "NULL" : `'${actor}'`}, '2026-04-22')
  `);

  it("SELECT — 세션 미주입 → 0 row", async () => {
    await seedEntry("alice");
    const rows = await appSql`SELECT * FROM audit.audit_entries`;
    expect(rows.length).toBe(0);
  });

  it("SELECT — actor 본인 + AUDIT_READ_BIT → 1 row", async () => {
    await seedEntry("alice");
    const mask = setBitHex(AUDIT_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT span_id FROM audit.audit_entries`;
      expect(rows.length).toBe(1);
    });
  });

  it("SELECT — 다른 actor 는 0 row", async () => {
    await seedEntry("alice");
    const mask = setBitHex(AUDIT_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'bob', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM audit.audit_entries`;
      expect(rows.length).toBe(0);
    });
  });

  it("INSERT — actor_user_id NULL 은 통과 (시스템 trace)", async () => {
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'system', true)`;
      await tx`INSERT INTO audit.audit_entries (span_id, trace_id, root_span_id, depth, kind, started_at) VALUES ('sp-sys', 't1', 'sp-sys', 0, 'execution', '2026-04-22')`;
    });
    const rows = await adminSql`SELECT span_id FROM audit.audit_entries WHERE span_id='sp-sys'`;
    expect(rows.length).toBe(1);
  });

  it("INSERT — 대리 기록 (actor 불일치) 차단", async () => {
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', 'alice', true)`;
        await tx`INSERT INTO audit.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at) VALUES ('sp-bad', 't1', 'sp-bad', 0, 'execution', 'bob', '2026-04-22')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("admin bypass — app.role=admin 은 모든 actor 조회 가능", async () => {
    await seedEntry("alice");
    await seedEntry("bob");
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      const rows = await tx`SELECT span_id FROM audit.audit_entries ORDER BY span_id`;
      expect(rows.length).toBe(2);
    });
  });
});
