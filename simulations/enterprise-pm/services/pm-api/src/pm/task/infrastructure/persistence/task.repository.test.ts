// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { TaskEntity } from "../../domain/index.js";
import {
  SqliteTaskRepository,
  createTaskRepository,
} from "./task.repository.js";
import { SIM_PM_SQLITE_DDL } from "../../../sqlite/schema.js";
import type { TaskTransactionScope } from "../../application/ports/task-transaction.port.js";

function makeScope(): TaskTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteTaskRepository", () => {
  it("save 후 findById 가 entity 를 라운드트립한다", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL); // tasks 테이블 (기존 schema)
    const db = drizzle({ client: sqlite });
    const repo = new SqliteTaskRepository(db);
    const entity = TaskEntity.create({
      id: "tsk_1",
      projectId: "prj_1",
      title: "Implement feature",
      assigneeId: "u_1",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(entity, makeScope());

    const found = await repo.findById("tsk_1");
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(entity.toSnapshot());

    sqlite.close();
  });

  it("findById 미존재 시 null", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteTaskRepository(db);
    expect(await repo.findById("missing")).toBeNull();
    sqlite.close();
  });

  it("listByProject + listSubtasks", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteTaskRepository(db);
    const parent = TaskEntity.create({
      id: "tsk_parent",
      projectId: "prj_1",
      title: "Parent",
    });
    const child = TaskEntity.create({
      id: "tsk_child",
      projectId: "prj_1",
      title: "Child",
      parentTaskId: "tsk_parent",
    });
    await repo.save(parent, makeScope());
    await repo.save(child, makeScope());

    expect((await repo.listByProject("prj_1")).length).toBe(2);
    expect((await repo.listSubtasks("tsk_parent")).length).toBe(1);
    sqlite.close();
  });

  it("delete — row 제거", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteTaskRepository(db);
    const e = TaskEntity.create({ id: "tsk_d", projectId: "p", title: "T" });
    await repo.save(e, makeScope());
    await repo.delete("tsk_d", makeScope());
    expect(await repo.findById("tsk_d")).toBeNull();
    sqlite.close();
  });
});

describe("createTaskRepository factory", () => {
  it("sqlite dialect → SqliteTaskRepository", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createTaskRepository({ dialect: "sqlite", db });
    expect(r).toBeInstanceOf(SqliteTaskRepository);
    sqlite.close();
  });

  it("알 수 없는 dialect 는 예외", () => {
    expect(() => createTaskRepository({ dialect: "mysql" as never, db: {} as never })).toThrow();
  });
});
