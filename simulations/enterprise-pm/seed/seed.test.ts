// @def.boundary sim-seed
// @def.doc sim-erp-pm-design

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SEED_DIR = dirname(fileURLToPath(import.meta.url));

describe("seed.ts runner — 정합성 회귀 (코드 읽기만)", () => {
  it("requiredTables가 auth_* 네이밍으로 업데이트됨", async () => {
    const src = await readFile(resolve(SEED_DIR, "seed.ts"), "utf-8");
    expect(src).toMatch(
      /requiredTables\s*=\s*\[[\s\S]*?"auth_departments"[\s\S]*?"auth_roles"[\s\S]*?"auth_users"[\s\S]*?"auth_role_assignments"/,
    );
    expect(src).not.toMatch(
      /requiredTables\s*=\s*\[[\s\S]*?"department"[\s\S]*?"role"[\s\S]*?"user"[\s\S]*?"role_assignment"\s*\]/,
    );
  });

  it("count query가 auth_* 테이블 조회", async () => {
    const src = await readFile(resolve(SEED_DIR, "seed.ts"), "utf-8");
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_departments/);
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_roles/);
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_users/);
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_role_assignments/);
    // 과거 단수형 미사용
    expect(src).not.toMatch(/FROM\s+\$\{sql\([^)]+\)\}\."user"/);
  });

  it("SEED_FILES 순서 = [departments, roles, users, role-assignments] (FK 의존)", async () => {
    const src = await readFile(resolve(SEED_DIR, "seed.ts"), "utf-8");
    const m = src.match(/SEED_FILES\s*=\s*\[([\s\S]*?)\]/);
    expect(m).toBeTruthy();
    const order = m![1].match(/"([^"]+)"/g)!.map((s) => s.slice(1, -1));
    expect(order).toEqual([
      "departments.sql",
      "roles.sql",
      "users.sql",
      "role-assignments.sql",
    ]);
  });
});
