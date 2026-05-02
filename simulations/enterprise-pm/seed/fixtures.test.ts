// @def.boundary sim-seed
// @def.doc sim-erp-pm-design

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { USERS, DEPARTMENTS, ROLES } from "./fixtures.js";

const SEED_DIR = dirname(fileURLToPath(import.meta.url));

async function loadSql(file: string): Promise<string> {
  return readFile(resolve(SEED_DIR, file), "utf-8");
}

describe("fixtures 상수 ↔ SQL 데이터 정합성", () => {
  it("USERS — 각 fixture user의 id/email이 users.sql에 존재", async () => {
    const sql = await loadSql("users.sql");
    for (const user of Object.values(USERS)) {
      expect(sql).toContain(`'${user.id}'`);
      expect(sql).toContain(`'${user.email}'`);
    }
  });

  it("DEPARTMENTS — 각 fixture dept id가 departments.sql에 존재", async () => {
    const sql = await loadSql("departments.sql");
    for (const dept of Object.values(DEPARTMENTS)) {
      expect(sql).toContain(`'${dept.id}'`);
      expect(sql).toContain(`'${dept.name}'`);
    }
  });

  it("ROLES — 각 fixture role id가 roles.sql에 존재", async () => {
    const sql = await loadSql("roles.sql");
    for (const role of Object.values(ROLES)) {
      expect(sql).toContain(`'${role.id}'`);
      expect(sql).toContain(`'${role.name}'`);
    }
  });


  it("alice/bob의 department-scoped role_assignment — project_manager", async () => {
    const sql = await loadSql("role-assignments.sql");
    expect(sql).toMatch(
      /'u-alice-001',\s*'r-project-manager',\s*'department',\s*'d-eng'/,
    );
    expect(sql).toMatch(
      /'u-bob-001',\s*'r-project-manager',\s*'department',\s*'d-mkt'/,
    );
  });

  it("admin의 global role_assignment (scope_id='')", async () => {
    const sql = await loadSql("role-assignments.sql");
    expect(sql).toMatch(/'u-admin-001',\s*'r-admin',\s*'global',\s*''/);
  });

  it("naming drift 감지 — sim.department 등 과거 테이블명 미사용", async () => {
    for (const file of [
      "departments.sql",
      "roles.sql",
      "users.sql",
      "role-assignments.sql",
    ]) {
      const sql = await loadSql(file);
      expect(sql).not.toMatch(/INSERT INTO sim\.department\b/);
      // sim.role 또는 sim.roles 는 허용 (auth_roles 이니)
      expect(sql).not.toMatch(/INSERT INTO sim\."user"/);
      expect(sql).not.toMatch(/INSERT INTO sim\.role_assignment\b/);
    }
  });

  it("BIGSERIAL setval 호출 제거 — 모든 SQL 파일에서", async () => {
    for (const file of [
      "departments.sql",
      "roles.sql",
      "users.sql",
      "role-assignments.sql",
    ]) {
      const sql = await loadSql(file);
      expect(sql).not.toMatch(/setval/);
      expect(sql).not.toMatch(/BIGSERIAL/);
    }
  });
});
