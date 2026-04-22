// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PgResourcePolicyRegistry } from "./adapter.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

/**
 * 테스트 격리 전략:
 *   - drizzle pgSchema("auth")는 항상 auth.resource_policies를 대상으로 함
 *   - 매 테스트마다 auth.resource_policies를 drop+create (RLS 정책 포함)
 *   - qa_admin은 schema 소유주가 아니므로 DROP SCHEMA는 불가, DROP TABLE만 가능
 *   - schema 자체는 init.sql에서 이미 생성됨
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
CREATE POLICY rp_temp_allow_all ON auth.resource_policies
  USING (true)
  WITH CHECK (true);
`;

describe.skipIf(!PG_AVAILABLE)("PgResourcePolicyRegistry — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let registry: PgResourcePolicyRegistry;

  beforeEach(async () => {
    sql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: PG_USER, password: PG_PASSWORD, max: 5, onnotice: () => {},
    });
    await sql.unsafe(RESET_TABLE_DDL);
    registry = new PgResourcePolicyRegistry(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS auth.resource_policies CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it("create + resolve — PG에서도 동일 동작", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u" });
    const p = await registry.resolve("d");
    expect(p?.state).toBe("UNREGISTERED");
  });

  it("RLS placeholder 정책이 임시 통과 (rp_temp_allow_all)", async () => {
    // RLS는 enabled이지만 임시 정책으로 모두 통과해야 함
    await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u1" });
    const p = await registry.resolve("d1");
    expect(p).not.toBeNull();
  });

  it("CHECK constraint 동작 — invalid state 거절", async () => {
    // 어댑터를 우회한 raw INSERT로만 검증 가능 (어댑터는 valid 값만 사용)
    await expect(
      sql`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
          VALUES ('bad', 'doc', 'INVALID_STATE', 'u', '2026-04-22')`,
    ).rejects.toThrow();
  });

  it("listByState — PG 인덱스 사용 plan (smoke)", async () => {
    await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u" });
    await registry.create({ resourceId: "d2", resourceType: "doc", ownerId: "u" });
    const unreg = await registry.listByState("UNREGISTERED");
    expect(unreg).toHaveLength(2);
  });
});
