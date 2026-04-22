// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RP_READ_BIT, RP_WRITE_BIT } from "./rls-bits.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

/**
 * hex bitmap 에서 특정 pos 의 비트를 set. 무한 확장.
 */
function setBitHex(pos: number, hex = ""): string {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  while (bytes.length <= byteIdx) bytes.push(0);
  bytes[byteIdx] |= 1 << bitIdx;
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Plan 15b RLS 정책 매트릭스 — auth.resource_policies.
 *
 * pgSchema("auth") drizzle 하드코딩 + 다중 스키마 어려움 → 기존 adapter.test.ts 패턴 차용:
 * qa_admin 으로 테이블 DROP+CREATE (정책 포함), auth_app 저권한 연결로 정책 효과 검증.
 * fileParallelism: false 가 vitest.config.ts 에 적용됨.
 *
 * 주의: FORCE 미적용 상태 (Plan 15e 전) — qa_admin 은 table owner 로서 RLS bypass.
 * 정책 검증은 반드시 auth_app 연결로 수행.
 */
const RESET_TABLE_DDL = `
DROP TABLE IF EXISTS auth.resource_policies CASCADE;

CREATE TABLE auth.resource_policies (
  resource_id       TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL,
  state             VARCHAR(16) NOT NULL CHECK (state IN ('UNREGISTERED','REGISTERED','DELEGATED')),
  owner_id          TEXT NOT NULL,
  cerbos_policy_ref TEXT,
  graph_root_id     TEXT,
  registered_at     TEXT,
  delegated_at      TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_rp_owner_pg ON auth.resource_policies(owner_id);
CREATE INDEX idx_rp_state_pg ON auth.resource_policies(state);
CREATE INDEX idx_rp_type_pg ON auth.resource_policies(resource_type);

ALTER TABLE auth.resource_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_admin_bypass ON auth.resource_policies
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY rp_select_policy ON auth.resource_policies
  FOR SELECT
  USING (
    auth.has_bit(10)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  );

CREATE POLICY rp_insert_policy ON auth.resource_policies
  FOR INSERT
  WITH CHECK (
    auth.has_bit(11)
    AND owner_id = auth.current_user_id()
  );

CREATE POLICY rp_update_policy ON auth.resource_policies
  FOR UPDATE
  USING (
    auth.has_bit(11)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  )
  WITH CHECK (
    owner_id = auth.current_user_id()
  );

CREATE POLICY rp_delete_policy ON auth.resource_policies
  FOR DELETE
  USING (
    auth.has_bit(12)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  );

-- auth_app 에 DML 명시적 부여 (qa_admin 이 만든 테이블이라 ALTER DEFAULT 미적용)
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.resource_policies TO auth_app;
`;

describe.skipIf(!PG_AVAILABLE)("auth.resource_policies RLS — Plan 15b", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";
  const AUTH_APP_PASSWORD = process.env.QA_TEST_PG_AUTH_APP_PASSWORD ?? "";

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
      user: "auth_app", password: AUTH_APP_PASSWORD,
      max: 3, onnotice: () => {},
    });
  });

  afterEach(async () => {
    try {
      await adminSql.unsafe(`DROP TABLE IF EXISTS auth.resource_policies CASCADE`);
    } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  it("SELECT — 세션 미주입 → 0 row (default deny)", async () => {
    await adminSql.unsafe(`
      INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')
    `);
    // app_sql 세션에는 SET LOCAL 주입 없음 → helper 모두 NULL → 정책 false
    const rows = await appSql`SELECT * FROM auth.resource_policies`;
    expect(rows.length).toBe(0);
  });

  it("SELECT — owner + RP_READ_BIT set → 1 row", async () => {
    await adminSql.unsafe(`
      INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')
    `);
    const mask = setBitHex(RP_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT resource_id FROM auth.resource_policies`;
      expect(rows.length).toBe(1);
      expect(rows[0].resource_id).toBe("r1");
    });
  });

  it("SELECT — non-owner 는 RP_READ_BIT 있어도 0 row", async () => {
    await adminSql.unsafe(`
      INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')
    `);
    const mask = setBitHex(RP_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'bob', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM auth.resource_policies`;
      expect(rows.length).toBe(0);
    });
  });

  it("SELECT — REGISTERED 상태는 owner 여도 0 row (DB 직접 접근 금지)", async () => {
    await adminSql.unsafe(`
      INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'REGISTERED', 'alice', '2026-04-22')
    `);
    const mask = setBitHex(RP_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM auth.resource_policies`;
      expect(rows.length).toBe(0);
    });
  });

  it("INSERT — owner 일치 + RP_WRITE_BIT → 성공", async () => {
    const mask = setBitHex(RP_WRITE_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      await tx`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-ok', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`;
    });
    const rows = await adminSql`SELECT resource_id FROM auth.resource_policies WHERE resource_id='r-ok'`;
    expect(rows.length).toBe(1);
  });

  it("INSERT — owner 불일치 → 실패", async () => {
    const mask = setBitHex(RP_WRITE_BIT);
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', 'alice', true)`;
        await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
        await tx`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-bad', 'doc', 'UNREGISTERED', 'bob', '2026-04-22')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("admin bypass — app.role=admin 이면 모든 state 가시", async () => {
    await adminSql.unsafe(`
      INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r-reg', 'doc', 'REGISTERED', 'alice', '2026-04-22')
    `);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      const rows = await tx`SELECT resource_id FROM auth.resource_policies WHERE resource_id='r-reg'`;
      expect(rows.length).toBe(1);
    });
  });
});
