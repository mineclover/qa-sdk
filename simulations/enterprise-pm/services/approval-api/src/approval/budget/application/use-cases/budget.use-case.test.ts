// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { BudgetUseCase } from "./budget.use-case.js";
import { BudgetEntity } from "../../domain/index.js";
import type { BudgetRepositoryPort } from "../ports/budget-repository.port.js";
import type {
  BudgetOutboxPort,
  BudgetOutboxRecord,
} from "../ports/budget-outbox.port.js";
import type {
  BudgetTransactionPort,
  BudgetTransactionScope,
} from "../ports/budget-transaction.port.js";
import type { BudgetLoggerPort } from "../ports/budget-logger.port.js";

function makeMocks(initial?: BudgetEntity) {
  const calls: string[] = [];
  const scope: BudgetTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const transaction: BudgetTransactionPort = {
    async run<T>(_name: string, work: (s: BudgetTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };
  let stored: BudgetEntity | null = initial ?? null;
  const repository: BudgetRepositoryPort = {
    save: vi.fn(async (e: BudgetEntity) => {
      calls.push("repository.save");
      stored = e;
    }),
    findById: vi.fn(async () => stored),
  };
  const outboxRecords: BudgetOutboxRecord[] = [];
  const outbox: BudgetOutboxPort = {
    append: vi.fn(async (record: BudgetOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: BudgetLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${(ctx as { outcome?: string }).outcome ?? "started"}`);
      logged.push({ level: "info", ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: "warn", ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? "?"}`);
      logged.push({ level: "error", ctx: ctx as never, msg });
    },
  };
  return { transaction, repository, outbox, outboxRecords, logger, logged, calls };
}

const createCommand = {
  id: "br_001",
  projectId: "prj_001",
  projectDepartmentId: "dept_eng",
  amount: 500_000,
  requesterId: "user_001",
  traceId: "trc_a",
  correlationId: "cor_a",
};

describe("BudgetUseCase.create", () => {
  it("transaction.run 이 repository.save + outbox.append 를 wrapping 한다", async () => {
    const m = makeMocks();
    const useCase = new BudgetUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(createCommand);
    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "outbox.append",
      "transaction.run.commit",
      "logger.info:success",
    ]);
  });

  it("outbox 레코드 shape — eventName=approval.budget.submitted v1 + idempotencyKey grammar #12", async () => {
    const m = makeMocks();
    const useCase = new BudgetUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(createCommand);
    expect(m.outboxRecords[0]).toMatchObject({
      aggregateId: "br_001",
      eventName: "approval.budget.submitted",
      eventVersion: 1,
    });
    // idempotencyKey 는 grammar #12 형식이어야 한다 (3-tier kebab + epoch ms).
    expect(m.outboxRecords[0].idempotencyKey).toMatch(
      /^br-001:approval\.budget\.submitted:\d+$/,
    );
  });

  it("policyLifecycle 미주입 시에도 정상 동작 (fail-open)", async () => {
    const m = makeMocks();
    const useCase = new BudgetUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const r = await useCase.create(createCommand);
    expect(r.totalStages).toBe(1);
  });

  it("policyLifecycle 실패 시 logger.warn 후 success 로 진행", async () => {
    const m = makeMocks();
    const lifecycle = {
      onCreated: vi.fn(async () => {
        throw new Error("policy down");
      }),
    };
    const useCase = new BudgetUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      lifecycle,
    );
    const r = await useCase.create(createCommand);
    expect(r.id).toBe("br_001");
    expect(m.logged.some((l) => l.level === "warn")).toBe(true);
  });

  it("repository.save 실패 시 outcome=failure rethrow", async () => {
    const m = makeMocks();
    (m.repository.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("boom"), { name: "ConflictError" }),
    );
    const useCase = new BudgetUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(useCase.create(createCommand)).rejects.toThrow("boom");
    expect(m.calls).toContain("logger.error:failure");
  });
});

describe("BudgetUseCase transitions", () => {
  it("submit + startReview + decide(approved) 라운드트립 (1-stage)", async () => {
    const initial = BudgetEntity.create({
      id: "br_002",
      projectId: "prj",
      projectDepartmentId: "dept",
      amount: 500_000,
      requesterId: "u",
    });
    const m = makeMocks(initial);
    const useCase = new BudgetUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const a = await useCase.submit("br_002");
    expect(a.status).toBe("submitted");
    const b = await useCase.startReview("br_002");
    expect(b.status).toBe("in_review");
    const c = await useCase.decide({ id: "br_002", approverId: "mgr", decision: "approved" });
    expect(c.status).toBe("approved");
  });

  it("decide 시 BudgetNotFoundException 매핑", async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const useCase = new BudgetUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.decide({ id: "missing", approverId: "x", decision: "approved" }),
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });
});
