// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { withRlsContext } from "db-bootstrap";
import { RP_READ_BIT, RP_WRITE_BIT } from "./rls-bits.js";
import { RlsAwarePgResourcePolicyRegistry } from "./rls-aware-adapter.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

function maskWithBit(pos: number): Uint8Array {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const out = new Uint8Array(byteIdx + 1);
  out[byteIdx] = 1 << bitIdx;
  return out;
}

/**
 * Plan 15c — RlsAwarePgResourcePolicyRegistry 통합 테스트.
 *
 * 기존 adapter.test.ts 패턴 차용 (drizzle pgSchema 우회):
 * qa_admin 으로 DDL+seed, auth_app 저권한 연결 + RLS context 주입 검증.
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

GRANT SELECT, INSERT, UPDATE, DELETE ON auth.resource_policies TO auth_app;
`;

describe.skipIf(!PG_AVAILABLE)("RlsAwarePgResourcePolicyRegistry — Plan 15c", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const AUTH_APP_PASSWORD = process.env.QA_TEST_PG_AUTH_APP_PASSWORD ?? "";
  const ADMIN_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let registry: RlsAwarePgResourcePolicyRegistry;

  beforeEach(async () => {
    adminSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: "qa_admin", password: ADMIN_PASSWORD, max: 3, onnotice: () => {},
    });
    await adminSql.unsafe(RESET_TABLE_DDL);
    appSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: "auth_app", password: AUTH_APP_PASSWORD, max: 3, onnotice: () => {},
    });
    registry = new RlsAwarePgResourcePolicyRegistry(appSql);
  });

  afterEach(async () => {
    try {
      await adminSql.unsafe(`DROP TABLE IF EXISTS auth.resource_policies CASCADE`);
    } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  it("ALS context 없으면 default deny (SELECT 0 row)", async () => {
    await adminSql.unsafe(`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const rows = await registry.listByOwner("alice");
    expect(rows.length).toBe(0);
  });

  it("ALS context 주입 후 호출 — owner policy 통과", async () => {
    await adminSql.unsafe(`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const rows = await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: maskWithBit(RP_READ_BIT), role: null },
      () => registry.listByOwner("alice"),
    );
    expect(rows.length).toBe(1);
  });

  it("explicit overrideContext", async () => {
    await adminSql.unsafe(`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const cliRegistry = new RlsAwarePgResourcePolicyRegistry(appSql, {
      userId: "alice", tenantId: null, bitmapMask: maskWithBit(RP_READ_BIT), role: null,
    });
    const rows = await cliRegistry.listByOwner("alice");
    expect(rows.length).toBe(1);
  });

  it("create — WITH CHECK 정책 통과", async () => {
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: maskWithBit(RP_WRITE_BIT), role: null },
      async () => {
        await registry.create({ resourceId: "new-r", resourceType: "doc", ownerId: "alice" });
      },
    );
    const rows = await adminSql`SELECT resource_id FROM auth.resource_policies WHERE resource_id='new-r'`;
    expect(rows.length).toBe(1);
  });

  it("admin bypass — role='admin' context → REGISTERED 리소스도 보임", async () => {
    await adminSql.unsafe(`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-reg', 'doc', 'REGISTERED', 'alice', '2026-04-22')`);
    const rows = await withRlsContext(
      { userId: null, tenantId: null, bitmapMask: null, role: "admin" },
      () => registry.listByState("REGISTERED"),
    );
    expect(rows.length).toBe(1);
  });
});
