// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { BudgetEntity } from "../../domain/index.js";
import { SqliteBudgetRepository } from "../persistence/budget.repository.js";
import { SIM_APPROVAL_BUDGET_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { createBudgetSqliteTransactionPort } from "./budget.drizzle-transaction.js";
import { createBudgetOutboxPort } from "../outbox/budget.outbox.js";
import { BudgetUnitOfWork } from "./budget.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_APPROVAL_BUDGET_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteBudgetRepository(db);
  const transaction = createBudgetSqliteTransactionPort(db);
  const outbox = createBudgetOutboxPort({ dialect: "sqlite", db });
  const uow = new BudgetUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe("BudgetUnitOfWork", () => {
  it("commit: repo.save + outbox.append 동일 트랜잭션 영속", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const entity = BudgetEntity.create({
      id: "br_uow_1",
      projectId: "p",
      projectDepartmentId: "d",
      amount: 500_000,
      requesterId: "u",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });
    await uow.withinTransaction("budget.create", async (ctx) => {
      await ctx.repository.save(entity, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "br_uow_1",
          eventName: "approval.budget.submitted",
          eventVersion: 1,
          payload: { id: "br_uow_1" },
          occurredAt: new Date("2026-03-01T00:00:01.000Z"),
          idempotencyKey: "br-uow-1:approval.budget.submitted:1740614401000",
        },
        ctx.scope,
      );
    });
    expect(await repo.findById("br_uow_1")).not.toBeNull();
    const rows = sqlite.prepare("SELECT * FROM approval_outbox_events").all() as Array<{
      aggregate_id: string;
      event_name: string;
      status: string;
      scope_id: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].aggregate_id).toBe("br_uow_1");
    expect(rows[0].event_name).toBe("approval.budget.submitted");
    expect(rows[0].status).toBe("pending");
    expect(rows[0].scope_id.startsWith("budget.create:")).toBe(true);
    sqlite.close();
  });

  it("rollback: throw 시 repo + outbox 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("budget.create", async (ctx) => {
        const e = BudgetEntity.create({
          id: "br_uow_2",
          projectId: "p",
          projectDepartmentId: "d",
          amount: 500_000,
          requesterId: "u",
        });
        await ctx.repository.save(e, ctx.scope);
        await ctx.outbox.append(
          {
            aggregateId: "br_uow_2",
            eventName: "approval.budget.submitted",
            eventVersion: 1,
            payload: {},
            occurredAt: new Date(),
            idempotencyKey: `br-uow-2:approval.budget.submitted:${Date.now()}`,
          },
          ctx.scope,
        );
        throw new Error("simulated");
      }),
    ).rejects.toThrow("simulated");
    expect(await repo.findById("br_uow_2")).toBeNull();
    const rows = sqlite.prepare("SELECT * FROM approval_outbox_events").all();
    expect(rows).toHaveLength(0);
    sqlite.close();
  });
});
