// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { AssignmentUseCase } from "./assignment.use-case.js";
import type { AssignmentRepositoryPort } from "../ports/assignment-repository.port.js";
import type {
  AssignmentOutboxPort,
  AssignmentOutboxRecord,
} from "../ports/assignment-outbox.port.js";
import type {
  AssignmentTransactionPort,
  AssignmentTransactionScope,
} from "../ports/assignment-transaction.port.js";
import type { AssignmentLoggerPort } from "../ports/assignment-logger.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: AssignmentTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const transaction: AssignmentTransactionPort = {
    async run<T>(_name: string, work: (s: AssignmentTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };

  const repository: AssignmentRepositoryPort = {
    save: vi.fn(async () => {
      calls.push("repository.save");
    }),
    findById: vi.fn(async () => null),
  };

  const outboxRecords: AssignmentOutboxRecord[] = [];
  const outbox: AssignmentOutboxPort = {
    append: vi.fn(async (record: AssignmentOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: AssignmentLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${ctx.outcome ?? "started"}`);
      logged.push({ level: "info", ctx: ctx as unknown as Record<string, unknown>, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: "warn", ctx: ctx as unknown as Record<string, unknown>, msg });
    },
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? "?"}`);
      logged.push({ level: "error", ctx: ctx as unknown as Record<string, unknown>, msg });
    },
  };

  return { transaction, repository, outbox, outboxRecords, logger, logged, calls };
}

describe("AssignmentUseCase.create", () => {
  const command = {
    id: "asg_001",
    projectId: "prj_001",
    managerId: "mgr_001",
    traceId: "trc_abc",
    correlationId: "cor_xyz",
  };

  it("transaction.run 이 repository.save + outbox.append 를 wrapping 한다", async () => {
    const m = makeMocks();
    const useCase = new AssignmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    // 호출 순서: transaction start → save → outbox → transaction commit → success log
    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "outbox.append",
      "transaction.run.commit",
      "logger.info:success",
    ]);
  });

  it("logger 가 SliceLogContext 표준 필드를 모두 emit 한다", async () => {
    const m = makeMocks();
    const useCase = new AssignmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    const startedLog = m.logged.find((l) => l.msg === "assignment.create.started")!;
    expect(startedLog.ctx).toMatchObject({
      traceId: "trc_abc",
      correlationId: "cor_xyz",
      domain: "assignment",
      useCase: "AssignmentUseCase.create",
      aggregateId: "asg_001",
      commandName: "CreateAssignmentCommand",
    });

    const successLog = m.logged.find((l) => l.msg === "assignment.create.success")!;
    expect(successLog.ctx).toMatchObject({
      outcome: "success",
      eventName: "assignment.created",
      eventVersion: 1,
    });
  });

  it("repository.save 실패 시 logger 가 outcome=failure 로 기록 후 rethrow", async () => {
    const m = makeMocks();
    (m.repository.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("boom"), { name: "ConflictError" }),
    );
    const useCase = new AssignmentUseCase(m.repository, m.outbox, m.transaction, m.logger);

    await expect(useCase.create(command)).rejects.toThrow("boom");
    expect(m.calls).toContain("logger.error:failure");

    const errLog = m.logged.find((l) => l.level === "error")!;
    expect(errLog.ctx.outcome).toBe("failure");
    expect(errLog.ctx.errorCode).toBe("ConflictError");
    expect(errLog.ctx.err).toBeInstanceOf(Error);
  });

  it("outbox 레코드 shape 가 OutboxRecord 컨벤션을 만족한다", async () => {
    const m = makeMocks();
    const useCase = new AssignmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    expect(m.outboxRecords[0]).toMatchObject({
      aggregateId: "asg_001",
      eventName: "assignment.created",
      eventVersion: 1,
    });
    expect(m.outboxRecords[0].payload).toMatchObject({
      id: "asg_001",
      projectId: "prj_001",
      managerId: "mgr_001",
    });
    expect(m.outboxRecords[0].occurredAt).toBeInstanceOf(Date);
  });

  it("traceId/correlationId 미제공 시 기본값 derivation", async () => {
    const m = makeMocks();
    const useCase = new AssignmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create({ id: "asg_002", projectId: "p", managerId: "m" });
    const startedLog = m.logged.find((l) => l.msg === "assignment.create.started")!;
    expect(startedLog.ctx.traceId).toBe("trace-asg_002");
    expect(startedLog.ctx.correlationId).toBe("trace-asg_002");
  });
});
