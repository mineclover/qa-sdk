// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const FORCE_APPLIED = process.env.QA_TEST_PG_FORCE === "1";

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
ALTER TABLE audit.audit_entries FORCE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT ON audit.audit_entries TO audit_app;
`;

describe.skipIf(!(PG_AVAILABLE && FORCE_APPLIED))("audit RLS enforce 회귀", () => {
  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    adminSql = postgres({
      host: process.env.QA_TEST_PG_HOST ?? "localhost",
      port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      user: "qa_admin", password: process.env.QA_TEST_PG_PASSWORD ?? "",
      max: 3, onnotice: () => {},
    });
    await adminSql.unsafe(RESET_TABLE_DDL);
    appSql = postgres({
      host: process.env.QA_TEST_PG_HOST ?? "localhost",
      port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      user: "audit_app", password: process.env.QA_TEST_PG_AUDIT_APP_PASSWORD ?? "",
      max: 3, onnotice: () => {},
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

  it("bob 이 alice 의 audit entry 조회 시 0 row (FORCE cross-actor deny)", async () => {
    // FORCE 상태 — qa_admin 도 정책 대상. admin context 로 seed.
    await adminSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      await tx`
        INSERT INTO audit.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at)
        VALUES ('sp-alice', 't', 'sp-alice', 0, 'execution', 'alice', '2026-04-22')`;
    });
    const mask = "00000010"; // bit 20
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'bob', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM audit.audit_entries`;
      expect(rows.length).toBe(0);
    });
  });

  it("qa_admin 도 FORCE 대상 — app.role 미주입이면 0 row", async () => {
    await adminSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      await tx`
        INSERT INTO audit.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at)
        VALUES ('sp-1', 't', 'sp-1', 0, 'execution', 'alice', '2026-04-22')`;
    });
    // app.role 미주입 SELECT
    const rows = await adminSql.unsafe(`SELECT * FROM audit.audit_entries`);
    expect(rows.length).toBe(0);
  });
});
