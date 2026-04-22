// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

/**
 * Port-contract test — SQLite + PG 어댑터에 동일 시나리오 적용 (Plan 05c 패턴).
 *
 * dialect-specific edge는 sqlite/adapter.test.ts, pg/adapter.test.ts가 담당.
 * 본 파일은 두 어댑터가 동일 port 계약을 만족하는지 회귀 게이트.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createAuthRepository, type AuthRepoDialect } from "./factory.js";
import { SIM_AUTH_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_AUTH_PG_RESET_DDL } from "./pg/schema.js";
import type { AuthRepository } from "./shared/port.js";

interface FixtureRunner {
  setup(): Promise<{ repo: AuthRepository; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const raw = new Database(":memory:");
    raw.exec(SIM_AUTH_SQLITE_DDL);
    const repo = await createAuthRepository({
      dialect: "sqlite",
      db: drizzleSqlite({ client: raw }),
    });
    return {
      repo,
      cleanup: async () => {
        raw.close();
      },
    };
  },
};

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    user: process.env.QA_TEST_PG_USER ?? "qa_admin",
    password: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  return {
    async setup() {
      const sql = postgres({
        host: PG_CFG.host,
        port: PG_CFG.port,
        database: PG_CFG.database,
        user: PG_CFG.user,
        password: PG_CFG.password,
        max: 5,
        onnotice: () => {},
      });
      await sql.unsafe(SIM_AUTH_PG_RESET_DDL);
      const repo = await createAuthRepository({
        dialect: "pg",
        db: drizzlePg({ client: sql }),
      });
      return {
        repo,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_role_assignments CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_roles CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_users CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.auth_departments CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const matrix: Array<[AuthRepoDialect, FixtureRunner]> = [
  ["sqlite", sqliteRunner],
  ...(PG_AVAILABLE
    ? ([["pg", makePgRunner()]] as Array<[AuthRepoDialect, FixtureRunner]>)
    : []),
];

describe.each(matrix)("AuthRepository contract — %s", (dialect, runner) => {
  let repo: AuthRepository;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await runner.setup();
    repo = ctx.repo;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it(`createUser + findUserByEmail — ${dialect}`, async () => {
    const u = await repo.createUser({ email: `c-${dialect}@x`, displayName: "c" });
    const read = await repo.findUserByEmail(`c-${dialect}@x`);
    expect(read?.id).toBe(u.id);
  });

  it(`createDepartment + resolveDepartmentChain (3-level tree) — ${dialect}`, async () => {
    const root = await repo.createDepartment({ name: `root-${dialect}` });
    const mid = await repo.createDepartment({ name: `mid-${dialect}`, parentId: root.id });
    const leaf = await repo.createDepartment({ name: `leaf-${dialect}`, parentId: mid.id });
    const chain = await repo.resolveDepartmentChain(leaf.id);
    expect(chain.length).toBe(3);
  });

  it(`createRole + assignRole + listAssignmentsForUser — ${dialect}`, async () => {
    const role = await repo.createRole({
      name: `role-${dialect}`,
      scopeType: "global",
      defaultMaskHex: "ff",
    });
    const u = await repo.createUser({ email: `r-${dialect}@x`, displayName: "r" });
    await repo.assignRole({
      userId: u.id,
      roleId: role.id,
      scopeType: "global",
      scopeId: null,
    });
    expect((await repo.listAssignmentsForUser(u.id))[0]?.roleId).toBe(role.id);
  });

  it(`revokeRole — assignment 삭제 (양쪽 dialect 동등) — ${dialect}`, async () => {
    const role = await repo.createRole({
      name: `rv-${dialect}`,
      scopeType: "global",
      defaultMaskHex: "ff",
    });
    const u = await repo.createUser({ email: `rv-${dialect}@x`, displayName: "rv" });
    await repo.assignRole({
      userId: u.id,
      roleId: role.id,
      scopeType: "global",
      scopeId: null,
    });
    await repo.revokeRole(u.id, role.id, "global", null);
    expect((await repo.listAssignmentsForUser(u.id)).length).toBe(0);
  });
});
