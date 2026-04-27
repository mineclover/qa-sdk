// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { TaskUseCase } from "./task.use-case.js";
import { TaskEntity, TaskNotFoundException } from "../../domain/index.js";
import type { TaskRepositoryPort } from "../ports/task-repository.port.js";
import type {
  TaskOutboxPort,
  TaskOutboxRecord,
} from "../ports/task-outbox.port.js";
import type {
  TaskTransactionPort,
  TaskTransactionScope,
} from "../ports/task-transaction.port.js";
import type { TaskLoggerPort } from "../ports/task-logger.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: TaskTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const transaction: TaskTransactionPort = {
    async run<T>(_name: string, work: (s: TaskTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };

  const repository: TaskRepositoryPort = {
    save: vi.fn(async () => {
      calls.push("repository.save");
    }),
    findById: vi.fn(async () => null),
    listByProject: vi.fn(async () => []),
    listSubtasks: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push("repository.delete");
    }),
  };

  const outboxRecords: TaskOutboxRecord[] = [];
  const outbox: TaskOutboxPort = {
    append: vi.fn(async (record: TaskOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: TaskLoggerPort = {
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

describe("TaskUseCase.create", () => {
  const command = {
    id: "tsk_001",
    projectId: "prj_001",
    title: "Demo task",
    traceId: "trc_t",
    correlationId: "cor_t",
  };

  it("transaction.run 이 repository.save + outbox.append 를 wrapping 한다", async () => {
    const m = makeMocks();
    const useCase = new TaskUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "outbox.append",
      "transaction.run.commit",
      "logger.info:success",
    ]);
  });

  it("logger 가 SliceLogContext 표준 필드를 emit", async () => {
    const m = makeMocks();
    const useCase = new TaskUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    const startedLog = m.logged.find((l) => l.msg === "task.create.started")!;
    expect(startedLog.ctx).toMatchObject({
      traceId: "trc_t",
      correlationId: "cor_t",
      domain: "task",
      useCase: "TaskUseCase.create",
      aggregateId: "tsk_001",
      commandName: "CreateTaskCommand",
    });
  });

  it("repository.save 실패 시 outcome=failure rethrow", async () => {
    const m = makeMocks();
    (m.repository.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("boom"), { name: "ConflictError" }),
    );
    const useCase = new TaskUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(useCase.create(command)).rejects.toThrow("boom");
    expect(m.calls).toContain("logger.error:failure");
  });
});

describe("TaskUseCase.update", () => {
  it("기존 task 가 없으면 TaskNotFoundException", async () => {
    const m = makeMocks();
    const useCase = new TaskUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.update({ id: "missing", patch: { title: "X" } }),
    ).rejects.toThrow(TaskNotFoundException);
  });

  it("기존 task 가 있으면 patch 적용 후 outbox 발행", async () => {
    const m = makeMocks();
    const existing = TaskEntity.create({
      id: "tsk_2",
      projectId: "prj_2",
      title: "Original",
    });
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
    const useCase = new TaskUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const result = await useCase.update({ id: "tsk_2", patch: { title: "Updated" } });
    expect(result.title).toBe("Updated");
    expect(m.outboxRecords[0].eventName).toBe("task.updated");
  });
});

describe("TaskUseCase.delete", () => {
  it("repository.delete + outbox.append 호출", async () => {
    const m = makeMocks();
    const useCase = new TaskUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.delete({ id: "tsk_3" });
    expect(m.calls).toContain("repository.delete");
    expect(m.outboxRecords[0].eventName).toBe("task.deleted");
  });
});
