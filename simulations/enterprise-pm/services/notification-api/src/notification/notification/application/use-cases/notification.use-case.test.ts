// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { NotificationUseCase } from "./notification.use-case.js";
import { NotificationEntity } from "../../domain/index.js";
import type { NotificationRepositoryPort } from "../ports/notification-repository.port.js";
import type {
  NotificationOutboxPort,
  NotificationOutboxRecord,
} from "../ports/notification-outbox.port.js";
import type {
  NotificationTransactionPort,
  NotificationTransactionScope,
} from "../ports/notification-transaction.port.js";
import type { NotificationLoggerPort } from "../ports/notification-logger.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: NotificationTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const transaction: NotificationTransactionPort = {
    async run<T>(_name: string, work: (s: NotificationTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };

  const store = new Map<string, NotificationEntity>();
  const repository: NotificationRepositoryPort = {
    save: vi.fn(async (entity: NotificationEntity) => {
      calls.push("repository.save");
      store.set(entity.id, entity);
    }),
    findById: vi.fn(async (id: string) => {
      calls.push("repository.findById");
      return store.get(id) ?? null;
    }),
    listForUser: vi.fn(async () => []),
  };

  const outboxRecords: NotificationOutboxRecord[] = [];
  const outbox: NotificationOutboxPort = {
    append: vi.fn(async (record: NotificationOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: NotificationLoggerPort = {
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

  return { transaction, repository, outbox, outboxRecords, logger, logged, calls, store };
}

describe("NotificationUseCase.create", () => {
  const command = {
    id: "ntf_001",
    recipientUserId: "usr_001",
    type: "budget.approved",
    title: "Budget approved",
    body: "Your budget request was approved.",
    traceId: "trc_abc",
    correlationId: "cor_xyz",
  };

  it("transaction.run 안에서 repository.save 가 호출된다", async () => {
    const m = makeMocks();
    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const result = await useCase.create(command);

    expect(result).toEqual({ id: "ntf_001", status: "pending" });
    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "transaction.run.commit",
      "logger.info:success",
    ]);
  });

  it("logger 가 SliceLogContext 표준 필드를 emit 한다", async () => {
    const m = makeMocks();
    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    const startedLog = m.logged.find((l) => l.msg === "notification.create.started")!;
    expect(startedLog.ctx).toMatchObject({
      traceId: "trc_abc",
      correlationId: "cor_xyz",
      domain: "notification",
      useCase: "NotificationUseCase.create",
      aggregateId: "ntf_001",
      commandName: "CreateNotificationCommand",
    });

    const successLog = m.logged.find((l) => l.msg === "notification.create.success")!;
    expect(successLog.ctx.outcome).toBe("success");
  });

  it("repository.save 실패 시 logger 가 outcome=failure 후 rethrow", async () => {
    const m = makeMocks();
    (m.repository.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("boom"), { name: "ConflictError" }),
    );
    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(useCase.create(command)).rejects.toThrow("boom");

    const errLog = m.logged.find((l) => l.level === "error")!;
    expect(errLog.ctx.outcome).toBe("failure");
    expect(errLog.ctx.errorCode).toBe("ConflictError");
  });
});

describe("NotificationUseCase.markSent", () => {
  it("notification.sent 이벤트를 outbox 에 append 한다", async () => {
    const m = makeMocks();
    // seed pending entity
    const seeded = NotificationEntity.create({
      id: "ntf_002",
      recipientUserId: "usr_002",
      type: "task.assigned",
      title: "Task",
      body: "body",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    m.store.set("ntf_002", seeded);

    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const result = await useCase.markSent({ id: "ntf_002" });

    expect(result.status).toBe("sent");
    expect(m.outboxRecords).toHaveLength(1);
    expect(m.outboxRecords[0]).toMatchObject({
      aggregateId: "ntf_002",
      eventName: "notification.sent",
      eventVersion: 1,
    });
    expect(m.outboxRecords[0].payload).toMatchObject({
      id: "ntf_002",
      recipientUserId: "usr_002",
      type: "task.assigned",
    });
  });

  it("미존재 id 시 NotFoundError", async () => {
    const m = makeMocks();
    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(useCase.markSent({ id: "missing" })).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });
});

describe("NotificationUseCase.markRead", () => {
  it("notification.delivered 이벤트를 outbox 에 append 한다", async () => {
    const m = makeMocks();
    const seeded = NotificationEntity.create({
      id: "ntf_003",
      recipientUserId: "usr_003",
      type: "x",
      title: "t",
      body: "b",
      now: new Date("2026-01-01T00:00:00.000Z"),
    }).markSent(new Date("2026-01-02T00:00:00.000Z"));
    m.store.set("ntf_003", seeded);

    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const result = await useCase.markRead({ id: "ntf_003" });

    expect(result.status).toBe("read");
    expect(m.outboxRecords[0].eventName).toBe("notification.delivered");
  });
});

describe("NotificationUseCase.markFailed", () => {
  it("notification.failed 이벤트를 outbox 에 append 한다", async () => {
    const m = makeMocks();
    const seeded = NotificationEntity.create({
      id: "ntf_004",
      recipientUserId: "usr_004",
      type: "x",
      title: "t",
      body: "b",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    m.store.set("ntf_004", seeded);

    const useCase = new NotificationUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const result = await useCase.markFailed({ id: "ntf_004" });

    expect(result.status).toBe("failed");
    expect(m.outboxRecords[0].eventName).toBe("notification.failed");
  });
});
