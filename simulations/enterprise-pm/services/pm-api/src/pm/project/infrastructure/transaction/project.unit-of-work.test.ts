// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { ProjectEntity } from "../../domain/index.js";
import { SqliteProjectRepository } from "../persistence/project.repository.js";
import { SIM_PM_SQLITE_DDL } from "../../../sqlite/schema.js";
import { createProjectSqliteTransactionPort } from "./project.drizzle-transaction.js";
import { createProjectOutboxPort } from "../outbox/project.outbox.js";
import { ProjectUnitOfWork } from "./project.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  // SIM_PM_SQLITE_DDL: projects 본 테이블 + pm-api domain 공유 outbox.
  sqlite.exec(SIM_PM_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteProjectRepository(db);
  const transaction = createProjectSqliteTransactionPort(db);
  const outbox = createProjectOutboxPort({ dialect: "sqlite", db });
  const uow = new ProjectUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe("ProjectUnitOfWork", () => {
  it("commit: repo.save + outbox.append 동일 트랜잭션", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = ProjectEntity.create({
      id: "prj_uow_1",
      name: "Demo",
      ownerId: "u",
      departmentId: "d",
    });
    await uow.withinTransaction("project.create", async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "prj_uow_1",
          eventName: "project.created",
          eventVersion: 1,
          payload: {},
          occurredAt: new Date(),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById("prj_uow_1")).not.toBeNull();
    const rows = sqlite.prepare("SELECT * FROM pm_outbox_events").all();
    expect(rows).toHaveLength(1);
    sqlite.close();
  });

  it("rollback: throw 시 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("project.create", async (ctx) => {
        await ctx.repository.save(
          ProjectEntity.create({ id: "px", name: "X", ownerId: "u", departmentId: "d" }),
          ctx.scope,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.findById("px")).toBeNull();
    sqlite.close();
  });
});
