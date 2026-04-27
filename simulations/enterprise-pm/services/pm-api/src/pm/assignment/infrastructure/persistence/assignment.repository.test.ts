// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AssignmentEntity } from "../../domain/index.js";
import {
  SqliteAssignmentRepository,
  PgAssignmentRepository,
  createAssignmentRepository,
} from "./assignment.repository.js";
import { SIM_PM_ASSIGNMENT_SQLITE_DDL } from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import type { AssignmentTransactionScope } from "../../application/ports/assignment-transaction.port.js";

function makeScope(): AssignmentTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteAssignmentRepository", () => {
  it("save 후 findById 가 entity 를 라운드트립한다", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteAssignmentRepository(db);
    const entity = AssignmentEntity.create({
      id: "asg_1",
      projectId: "prj_1",
      managerId: "mgr_1",
      now: new Date("2026-01-01T00:00:00.000Z"),
    }).assign(new Date("2026-01-02T00:00:00.000Z"));
    await repo.save(entity, makeScope());

    const found = await repo.findById("asg_1");
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(entity.toSnapshot());

    sqlite.close();
  });

  it("findById 미존재 시 null", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteAssignmentRepository(db);
    expect(await repo.findById("missing")).toBeNull();
    sqlite.close();
  });

  it("upsert: 동일 id save 시 update", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteAssignmentRepository(db);

    const e1 = AssignmentEntity.create({
      id: "asg_2",
      projectId: "prj_a",
      managerId: "mgr_a",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e1, makeScope());

    const e2 = e1.assign(new Date("2026-01-03T00:00:00.000Z"));
    await repo.save(e2, makeScope());

    const found = await repo.findById("asg_2");
    expect(found!.status).toBe("assigned");
    sqlite.close();
  });
});

describe("PgAssignmentRepository (column mapping symmetry)", () => {
  it("sqlite/pg 둘 다 동일 컬럼셋(JS 필드) 을 사용한다", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.assignments);
    const pgCols = Object.keys(pgSchemaModule.assignments);
    // drizzle table object 의 column field 만 추출하기 위해 row 키만 비교
    const expected = new Set(["id", "projectId", "managerId", "status", "createdAt", "updatedAt"]);
    for (const c of expected) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });

  it("PgAssignmentRepository 는 mock drizzle 에서 동일 매핑을 발행한다", async () => {
    const inserts: Array<{ table: unknown; row: Record<string, unknown> }> = [];
    const mockDb = {
      insert(table: unknown) {
        return {
          values(row: Record<string, unknown>) {
            inserts.push({ table, row });
            return {
              onConflictDoUpdate(_: unknown) {
                return Promise.resolve();
              },
            };
          },
        };
      },
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
        };
      },
    };
    const repo = new PgAssignmentRepository(mockDb as never);
    const entity = AssignmentEntity.create({
      id: "asg_3",
      projectId: "prj_3",
      managerId: "mgr_3",
      now: new Date("2026-02-01T00:00:00.000Z"),
    });
    await repo.save(entity, makeScope());
    expect(inserts).toHaveLength(1);
    expect(inserts[0].row).toMatchObject({
      id: "asg_3",
      projectId: "prj_3",
      managerId: "mgr_3",
      status: "draft",
    });
    expect(await repo.findById("asg_3")).toBeNull();
  });
});

describe("createAssignmentRepository factory", () => {
  it("sqlite dialect → SqliteAssignmentRepository", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createAssignmentRepository({ dialect: "sqlite", db });
    expect(r).toBeInstanceOf(SqliteAssignmentRepository);
    sqlite.close();
  });

  it("알 수 없는 dialect 는 예외", () => {
    expect(() => createAssignmentRepository({ dialect: "mysql" as never, db: {} as never })).toThrow();
  });
});
