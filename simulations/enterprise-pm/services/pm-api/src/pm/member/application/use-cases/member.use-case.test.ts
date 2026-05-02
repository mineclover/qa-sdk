// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { MemberUseCase } from "./member.use-case.js";
import type { MemberRepositoryPort } from "../ports/member-repository.port.js";
import type {
  MemberOutboxPort,
  MemberOutboxRecord,
} from "../ports/member-outbox.port.js";
import type {
  MemberTransactionPort,
  MemberTransactionScope,
} from "../ports/member-transaction.port.js";
import type { MemberLoggerPort } from "../ports/member-logger.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: MemberTransactionScope = { id: "tx-1", startedAt: new Date() };

  const transaction: MemberTransactionPort = {
    async run<T>(_name: string, work: (s: MemberTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };

  const repository: MemberRepositoryPort = {
    save: vi.fn(async () => {
      calls.push("repository.save");
    }),
    findById: vi.fn(async () => null),
    listForProject: vi.fn(async () => []),
    listForUser: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push("repository.delete");
    }),
  };

  const outboxRecords: MemberOutboxRecord[] = [];
  const outbox: MemberOutboxPort = {
    append: vi.fn(async (record: MemberOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: MemberLoggerPort = {
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

describe("MemberUseCase.add", () => {
  it("transaction.run wrapping repository.save + outbox.append", async () => {
    const m = makeMocks();
    const useCase = new MemberUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const res = await useCase.add({
      projectId: "prj_1",
      userId: "u_1",
      role: "lead",
    });
    expect(res.projectId).toBe("prj_1");
    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "outbox.append",
      "transaction.run.commit",
      "logger.info:success",
    ]);
  });

  it("logger SliceLogContext 표준 필드 emit", async () => {
    const m = makeMocks();
    const useCase = new MemberUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.add({ projectId: "prj_1", userId: "u_1", role: "lead" });
    const startedLog = m.logged.find((l) => l.msg === "member.add.started")!;
    expect(startedLog.ctx).toMatchObject({
      domain: "member",
      useCase: "MemberUseCase.add",
      commandName: "AddMemberCommand",
    });
  });

  it("repository.save 실패 시 outcome=failure rethrow", async () => {
    const m = makeMocks();
    (m.repository.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("dup"), { name: "ConflictError" }),
    );
    const useCase = new MemberUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.add({ projectId: "p", userId: "u", role: "lead" }),
    ).rejects.toThrow("dup");
    expect(m.calls).toContain("logger.error:failure");
  });
});

describe("MemberUseCase.remove", () => {
  it("repository.delete + outbox.append + outcome=success", async () => {
    const m = makeMocks();
    const useCase = new MemberUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.remove({ projectId: "prj_1", userId: "u_1" });
    expect(m.calls).toContain("repository.delete");
    expect(m.outboxRecords[0].eventName).toBe("member.removed");
  });
});
