// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { TimeOffEntity } from "../../domain/index.js";
import { SqliteTimeOffRepository } from "../persistence/timeoff.repository.js";
import { SIM_APPROVAL_TIMEOFF_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { createTimeOffSqliteTransactionPort } from "./timeoff.drizzle-transaction.js";
import { createTimeOffOutboxPort } from "../outbox/timeoff.outbox.js";
import { TimeOffUnitOfWork } from "./timeoff.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_APPROVAL_TIMEOFF_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteTimeOffRepository(db);
  const transaction = createTimeOffSqliteTransactionPort(db);
  const outbox = createTimeOffOutboxPort({ dialect: "sqlite", db });
  return { sqlite, repo, uow: new TimeOffUnitOfWork(transaction, repo, outbox) };
}

describe("TimeOffUnitOfWork", () => {
  it("commit: save + outbox 동일 트랜잭션", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = TimeOffEntity.create({
      id: "tof_uow_1",
      requesterId: "u",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      reason: "vacation",
    });
    await uow.withinTransaction("timeoff.create", async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "tof_uow_1",
          eventName: "timeoff.created",
          eventVersion: 1,
          payload: {},
          occurredAt: new Date(),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById("tof_uow_1")).not.toBeNull();
    sqlite.close();
  });

  it("rollback: throw 시 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("timeoff.create", async (ctx) => {
        const e = TimeOffEntity.create({
          id: "tof_uow_2",
          requesterId: "u",
          startDate: "2026-05-01",
          endDate: "2026-05-03",
          reason: "vacation",
        });
        await ctx.repository.save(e, ctx.scope);
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
    expect(await repo.findById("tof_uow_2")).toBeNull();
    sqlite.close();
  });
});
