// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DepartmentEntity } from "../../domain/index.js";
import {
  SqliteDepartmentRepository,
  createDepartmentRepository,
} from "./department.repository.js";
import { SIM_AUTH_DEPARTMENT_SQLITE_DDL } from "./sqlite.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import type { DepartmentTransactionScope } from "../../application/ports/department-transaction.port.js";

function scope(): DepartmentTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteDepartmentRepository", () => {
  it("save 후 findById", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_DEPARTMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteDepartmentRepository(db);
    const e = DepartmentEntity.create({ id: "d1", name: "Eng" });
    await repo.save(e, scope());
    const found = await repo.findById("d1");
    expect(found!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });

  it("resolveChain — parent traversal", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_DEPARTMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteDepartmentRepository(db);
    await repo.save(DepartmentEntity.create({ id: "root", name: "Root" }), scope());
    await repo.save(DepartmentEntity.create({ id: "mid", name: "Mid", parentId: "root" }), scope());
    await repo.save(DepartmentEntity.create({ id: "leaf", name: "Leaf", parentId: "mid" }), scope());
    const chain = await repo.resolveChain("leaf");
    expect(chain.map((d) => d.toSnapshot().name)).toEqual(["Leaf", "Mid", "Root"]);
    sqlite.close();
  });

  it("delete", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_DEPARTMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteDepartmentRepository(db);
    await repo.save(DepartmentEntity.create({ id: "d1", name: "X" }), scope());
    await repo.delete("d1", scope());
    expect(await repo.findById("d1")).toBeNull();
    sqlite.close();
  });
});

describe("dialect symmetry", () => {
  it("sqlite/pg 동일 컬럼", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.departments);
    const pgCols = Object.keys(pgSchemaModule.departments);
    for (const c of ["id", "name", "parentId", "managerId", "createdAt", "updatedAt"]) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe("createDepartmentRepository", () => {
  it("알 수 없는 dialect 는 예외", () => {
    expect(() => createDepartmentRepository({ dialect: "x" as never, db: {} as never })).toThrow();
  });
});
