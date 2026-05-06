// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { DocumentUseCase } from "./document.use-case.js";
import { DocumentEntity } from "../../domain/index.js";
import type { DocumentRepositoryPort } from "../ports/document-repository.port.js";
import type {
  DocumentOutboxPort,
  DocumentOutboxRecord,
} from "../ports/document-outbox.port.js";
import type {
  DocumentTransactionPort,
  DocumentTransactionScope,
} from "../ports/document-transaction.port.js";
import type { DocumentLoggerPort } from "../ports/document-logger.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: DocumentTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const transaction: DocumentTransactionPort = {
    async run<T>(_name: string, work: (s: DocumentTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };

  let stored: DocumentEntity | null = null;
  const repository: DocumentRepositoryPort = {
    save: vi.fn(async (e: DocumentEntity) => {
      calls.push("repository.save");
      stored = e;
    }),
    findById: vi.fn(async () => stored),
    listByProject: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push("repository.delete");
      stored = null;
    }),
  };

  const outboxRecords: DocumentOutboxRecord[] = [];
  const outbox: DocumentOutboxPort = {
    append: vi.fn(async (record: DocumentOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: DocumentLoggerPort = {
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

describe("DocumentUseCase.create", () => {
  const command = {
    id: "doc_001",
    projectId: "prj_001",
    title: "Spec Document",
    ownerId: "usr_001",
    traceId: "trc_abc",
    correlationId: "cor_xyz",
  };

  it("transaction.run 이 repository.save + outbox.append 를 wrapping", async () => {
    const m = makeMocks();
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
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
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);
    const startedLog = m.logged.find((l) => l.msg === "document.create.started")!;
    expect(startedLog.ctx).toMatchObject({
      traceId: "trc_abc",
      domain: "document",
      useCase: "DocumentUseCase.create",
      aggregateId: "doc_001",
      commandName: "CreateDocumentCommand",
    });
  });

  it("repository.save 실패 시 outcome=failure 후 rethrow", async () => {
    const m = makeMocks();
    (m.repository.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("boom"), { name: "ConflictError" }),
    );
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(useCase.create(command)).rejects.toThrow("boom");
    expect(m.calls).toContain("logger.error:failure");
  });

  it("outbox 레코드 shape 는 OutboxRecord 컨벤션을 만족", async () => {
    const m = makeMocks();
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);
    expect(m.outboxRecords[0]).toMatchObject({
      aggregateId: "doc_001",
      eventName: "document.document.created",
      eventVersion: 1,
    });
    expect(m.outboxRecords[0].payload).toMatchObject({
      id: "doc_001",
      title: "Spec Document",
    });
  });
});

describe("DocumentUseCase.update", () => {
  it("기존 document 미존재 시 NotFoundError", async () => {
    const m = makeMocks();
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.update({ id: "missing", title: "T" }),
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("성공 시 outbox 에 document.updated 발행", async () => {
    const m = makeMocks();
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create({
      id: "doc_u1",
      projectId: "p",
      title: "T",
      ownerId: "u",
    });
    await useCase.update({ id: "doc_u1", title: "T2" });
    const updated = m.outboxRecords.find((r) => r.eventName === "document.document.updated");
    expect(updated).toBeDefined();
    expect((updated!.payload as { title: string }).title).toBe("T2");
  });
});

describe("DocumentUseCase.delete", () => {
  it("repository.delete + outbox 발행", async () => {
    const m = makeMocks();
    const useCase = new DocumentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.delete({ id: "doc_d1" });
    expect(m.calls).toContain("repository.delete");
    expect(m.outboxRecords.find((r) => r.eventName === "document.document.deleted")).toBeDefined();
  });
});
