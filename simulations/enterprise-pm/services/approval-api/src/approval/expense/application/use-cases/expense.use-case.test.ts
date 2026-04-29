// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { ExpenseUseCase } from "./expense.use-case.js";
import { ExpenseEntity } from "../../domain/index.js";
import type { ExpenseRepositoryPort } from "../ports/expense-repository.port.js";
import type {
  ExpenseOutboxPort,
  ExpenseOutboxRecord,
} from "../ports/expense-outbox.port.js";
import type {
  ExpenseTransactionPort,
  ExpenseTransactionScope,
} from "../ports/expense-transaction.port.js";
import type { ExpenseLoggerPort } from "../ports/expense-logger.port.js";

function makeMocks(initial?: ExpenseEntity) {
  const calls: string[] = [];
  const scope: ExpenseTransactionScope = { id: "tx-1", startedAt: new Date() };
  const transaction: ExpenseTransactionPort = {
    async run<T>(_n: string, w: (s: ExpenseTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await w(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };
  let stored: ExpenseEntity | null = initial ?? null;
  const repository: ExpenseRepositoryPort = {
    save: vi.fn(async (e: ExpenseEntity) => {
      calls.push("repository.save");
      stored = e;
    }),
    findById: vi.fn(async () => stored),
  };
  const outboxRecords: ExpenseOutboxRecord[] = [];
  const outbox: ExpenseOutboxPort = {
    append: vi.fn(async (r: ExpenseOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(r);
    }),
  };
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: ExpenseLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${(ctx as { outcome?: string }).outcome ?? "started"}`);
      logged.push({ level: "info", ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => logged.push({ level: "warn", ctx: ctx as never, msg }),
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? "?"}`);
      logged.push({ level: "error", ctx: ctx as never, msg });
    },
  };
  return { transaction, repository, outbox, outboxRecords, logger, logged, calls };
}

describe("ExpenseUseCase", () => {
  it("create: tx + save + outbox + success log", async () => {
    const m = makeMocks();
    const uc = new ExpenseUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.create({
      id: "exp_1",
      requesterId: "u",
      amount: 1000,
      category: "travel",
      description: "x",
    });
    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "outbox.append",
      "transaction.run.commit",
      "logger.info:success",
    ]);
    expect(m.outboxRecords[0].eventName).toBe("approval.expense.submitted");
    expect(m.outboxRecords[0].idempotencyKey).toMatch(
      /^exp-1:approval\.expense\.submitted:\d+$/,
    );
  });

  it("updateStatus: 미존재 → ExpenseNotFoundException (NotFoundError)", async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const uc = new ExpenseUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      uc.updateStatus({ id: "missing", status: "submitted" }),
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });
});
