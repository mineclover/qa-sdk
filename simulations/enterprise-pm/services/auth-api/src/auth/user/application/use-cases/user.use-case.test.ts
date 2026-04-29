// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { UserUseCase } from "./user.use-case.js";
import { UserEntity } from "../../domain/index.js";
import type { UserRepositoryPort } from "../ports/user-repository.port.js";
import type {
  UserOutboxPort,
  UserOutboxRecord,
} from "../ports/user-outbox.port.js";
import type {
  UserTransactionPort,
  UserTransactionScope,
} from "../ports/user-transaction.port.js";
import type { UserLoggerPort } from "../ports/user-logger.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: UserTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const transaction: UserTransactionPort = {
    async run<T>(_name: string, work: (s: UserTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };

  const repository: UserRepositoryPort = {
    save: vi.fn(async () => {
      calls.push("repository.save");
    }),
    findById: vi.fn(async () => null),
    findByEmail: vi.fn(async () => null),
    listByDepartment: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push("repository.delete");
    }),
  };

  const outboxRecords: UserOutboxRecord[] = [];
  const outbox: UserOutboxPort = {
    append: vi.fn(async (record: UserOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: UserLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${ctx.outcome ?? "started"}`);
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

describe("UserUseCase.create", () => {
  const command = {
    id: "usr_001",
    email: "alice@example.com",
    displayName: "Alice",
    departmentId: "dept_1",
    traceId: "trc_abc",
    correlationId: "cor_xyz",
  };

  it("transaction.run 이 repository.save + outbox.append 를 wrapping 한다", async () => {
    const m = makeMocks();
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
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

  it("logger 가 SliceLogContext 표준 필드를 모두 emit", async () => {
    const m = makeMocks();
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    const startedLog = m.logged.find((l) => l.msg === "user.create.started")!;
    expect(startedLog.ctx).toMatchObject({
      traceId: "trc_abc",
      correlationId: "cor_xyz",
      domain: "user",
      useCase: "UserUseCase.create",
      aggregateId: "usr_001",
      commandName: "CreateUserCommand",
    });

    const successLog = m.logged.find((l) => l.msg === "user.create.success")!;
    expect(successLog.ctx).toMatchObject({
      outcome: "success",
      eventName: "auth.user.created",
      eventVersion: 1,
    });
  });

  it("findByEmail 에서 중복 확인 시 ConflictError 로 rethrow", async () => {
    const m = makeMocks();
    (m.repository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      UserEntity.create({ id: "u_dup", email: command.email, displayName: "X" }),
    );
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(useCase.create(command)).rejects.toMatchObject({ name: "ConflictError" });
    expect(m.calls).toContain("logger.error:failure");
  });

  it("outbox 레코드 shape 가 OutboxRecord 컨벤션을 만족한다", async () => {
    const m = makeMocks();
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);

    expect(m.outboxRecords[0]).toMatchObject({
      aggregateId: "usr_001",
      eventName: "auth.user.created",
      eventVersion: 1,
    });
    expect(m.outboxRecords[0].payload).toMatchObject({
      id: "usr_001",
      email: "alice@example.com",
      displayName: "Alice",
    });
    expect(m.outboxRecords[0].occurredAt).toBeInstanceOf(Date);
  });
});

describe("UserUseCase.update", () => {
  it("미존재 시 NotFoundError 를 던진다", async () => {
    const m = makeMocks();
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.update({ id: "missing", patch: { displayName: "x" } }),
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("존재 시 entity.updateProfile + save + outbox(user.updated)", async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      UserEntity.create({
        id: "usr_010",
        email: "x@x.com",
        displayName: "X",
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.update({ id: "usr_010", patch: { displayName: "X2" } });
    expect(m.outboxRecords[0]).toMatchObject({
      eventName: "auth.user.updated",
      aggregateId: "usr_010",
    });
    expect((m.outboxRecords[0].payload as { displayName: string }).displayName).toBe("X2");
  });
});

describe("UserUseCase.delete", () => {
  it("repository.delete + outbox(user.deleted)", async () => {
    const m = makeMocks();
    const useCase = new UserUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.delete({ id: "usr_020" });
    expect(m.calls).toContain("repository.delete");
    expect(m.outboxRecords[0]).toMatchObject({
      eventName: "auth.user.deleted",
      aggregateId: "usr_020",
    });
  });
});
