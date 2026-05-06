// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { buildIdempotencyKey } from "sim-identifier-grammar";
import { TaskEntity } from "../../domain/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import { SqliteTaskRepository } from "../persistence/task.repository.js";
import { SIM_PM_SQLITE_DDL } from "../../../sqlite/schema.js";
import { createTaskSqliteTransactionPort } from "./task.drizzle-transaction.js";
import { createTaskOutboxPort } from "../outbox/task.outbox.js";
import { TaskUnitOfWork } from "./task.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  // SIM_PM_SQLITE_DDL: tasks 본 테이블 + pm-api domain 공유 outbox.
  sqlite.exec(SIM_PM_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteTaskRepository(db);
  const transaction = createTaskSqliteTransactionPort(db);
  const outbox = createTaskOutboxPort({ dialect: "sqlite", db });
  const uow = new TaskUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe("TaskUnitOfWork", () => {
  it("commit: repo.save + outbox.append 가 동일 트랜잭션에 영속", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const entity = TaskEntity.create({
      id: "tsk_uow_1",
      projectId: "prj_1",
      title: "Demo",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    await uow.withinTransaction("task.create", async (ctx) => {
      await ctx.repository.save(entity, ctx.scope);
      const occurredAt = new Date("2026-03-01T00:00:01.000Z");
      const eventName = "pm.task.created";
      await ctx.outbox.append(
        {
          aggregateId: "tsk_uow_1",
          eventName,
          eventVersion: 1,
          payload: { id: "tsk_uow_1" },
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId("tsk_uow_1"),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });

    expect(await repo.findById("tsk_uow_1")).not.toBeNull();
    const outboxRows = sqlite.prepare("SELECT * FROM pm_outbox_events").all() as Array<{
      aggregate_id: string;
      event_name: string;
    }>;
    expect(outboxRows[0].aggregate_id).toBe("tsk_uow_1");
    expect(outboxRows[0].event_name).toBe("pm.task.created");
    sqlite.close();
  });

  it("rollback: throw 시 repo + outbox 모두 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("task.create", async (ctx) => {
        await ctx.repository.save(
          TaskEntity.create({ id: "tsk_uow_2", projectId: "p", title: "T" }),
          ctx.scope,
        );
        const occurredAt = new Date();
        const eventName = "pm.task.created";
        await ctx.outbox.append(
          {
            aggregateId: "tsk_uow_2",
            eventName,
            eventVersion: 1,
            payload: {},
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId("tsk_uow_2"),
              eventName,
              occurredAt,
            }),
          },
          ctx.scope,
        );
        throw new Error("simulated");
      }),
    ).rejects.toThrow("simulated");
    expect(await repo.findById("tsk_uow_2")).toBeNull();
    expect(sqlite.prepare("SELECT * FROM pm_outbox_events").all()).toHaveLength(0);
    sqlite.close();
  });
});
