// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PgPmRepository } from "./adapter.js";
import { SIM_PM_PG_RESET_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgPmRepository — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let repo: PgPmRepository;

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
    await sql.unsafe(SIM_PM_PG_RESET_DDL);
    repo = new PgPmRepository(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.pm_project_members CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.pm_tasks CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.pm_projects CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it("createProject round-trip", async () => {
    const p = await repo.createProject({ name: "P", ownerId: "u-1", departmentId: "d-1", status: "active" });
    expect((await repo.findProject(p.id))?.name).toBe("P");
  });

  it("listProjectsByDepartment", async () => {
    await repo.createProject({ name: "A", ownerId: "u-1", departmentId: "d-1" });
    await repo.createProject({ name: "B", ownerId: "u-2", departmentId: "d-1" });
    await repo.createProject({ name: "C", ownerId: "u-3", departmentId: "d-2" });
    expect((await repo.listProjectsByDepartment("d-1")).length).toBe(2);
  });
});
