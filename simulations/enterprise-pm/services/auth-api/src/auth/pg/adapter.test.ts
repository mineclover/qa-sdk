// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PgAuthRepository } from "./adapter.js";
import { SIM_AUTH_PG_RESET_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

/**
 * 테스트 격리 전략:
 *   - drizzle pgSchema("sim")은 항상 sim.auth_* 테이블을 대상으로 함
 *   - 매 테스트마다 sim.auth_* 테이블을 drop+create
 *   - schema 자체는 init.sql에서 이미 생성됨
 */
describe.skipIf(!PG_AVAILABLE)("PgAuthRepository — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let repo: PgAuthRepository;

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
    await sql.unsafe(SIM_AUTH_PG_RESET_DDL);
    repo = new PgAuthRepository(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_role_assignments CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_roles CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_users CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_departments CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it("createUser → findUser round-trip (PG schema 격리)", async () => {
    const u = await repo.createUser({ email: "pg@x.c", displayName: "PG" });
    expect((await repo.findUser(u.id))?.email).toBe("pg@x.c");
  });

  it("revokeRole — scopeId null 처리 (isNull 사용)", async () => {
    const role = await repo.createRole({ name: "pg-admin", scopeType: "global", defaultMaskHex: "ff" });
    const u = await repo.createUser({ email: "pg2@x.c", displayName: "PG2" });
    await repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    await repo.revokeRole(u.id, role.id, "global", null);
    expect((await repo.listAssignmentsForUser(u.id)).length).toBe(0);
  });
});
