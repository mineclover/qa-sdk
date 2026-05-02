// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { VersionUseCase } from "./version.use-case.js";
import { VersionEntity } from "../../domain/index.js";
import type { VersionRepositoryPort } from "../ports/version-repository.port.js";
import type {
  VersionOutboxPort,
  VersionOutboxRecord,
} from "../ports/version-outbox.port.js";
import type {
  VersionTransactionPort,
  VersionTransactionScope,
} from "../ports/version-transaction.port.js";
import type { VersionLoggerPort } from "../ports/version-logger.port.js";
import type { DocumentQueryPort } from "../ports/document-query.port.js";

function makeMocks(opts: { documentExists?: boolean; existingVersions?: number } = {}) {
  const calls: string[] = [];
  const scope: VersionTransactionScope = {
    id: "tx-1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const transaction: VersionTransactionPort = {
    async run<T>(_n: string, work: (s: VersionTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await work(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };
  let stored: VersionEntity | null = null;
  const repository: VersionRepositoryPort = {
    save: vi.fn(async (e: VersionEntity) => {
      calls.push("repository.save");
      stored = e;
    }),
    findByKey: vi.fn(async () => stored),
    listByDocument: vi.fn(async () => (stored ? [stored] : [])),
    latestVersionNumber: vi.fn(async () => opts.existingVersions ?? 0),
  };
  const outboxRecords: VersionOutboxRecord[] = [];
  const outbox: VersionOutboxPort = {
    append: vi.fn(async (r: VersionOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(r);
    }),
  };
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: VersionLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${ctx.outcome ?? "started"}`);
      logged.push({ level: "info", ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => logged.push({ level: "warn", ctx: ctx as never, msg }),
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? "?"}`);
      logged.push({ level: "error", ctx: ctx as never, msg });
    },
  };
  const documentQuery: DocumentQueryPort = {
    findSummary: vi.fn(async () =>
      opts.documentExists !== false
        ? { id: "doc_001", title: "Spec", projectId: "p", currentVersion: 0 }
        : null,
    ),
  };
  return { transaction, repository, outbox, outboxRecords, logger, logged, calls, documentQuery };
}

describe("VersionUseCase.create", () => {
  const command = {
    documentId: "doc_001",
    contentRef: "s3://bucket/k1",
    authorId: "u",
    traceId: "trc_a",
  };

  it("docQuery + tx + repo + outbox 호출 순서 + nextVersion=1", async () => {
    const m = makeMocks();
    const useCase = new VersionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    const res = await useCase.create(command);
    expect(res.versionNumber).toBe(1);
    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.start",
      "repository.save",
      "outbox.append",
      "transaction.run.commit",
      "logger.info:success",
    ]);
  });

  it("기존 버전 N → 다음 버전 N+1", async () => {
    const m = makeMocks({ existingVersions: 3 });
    const useCase = new VersionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    const res = await useCase.create(command);
    expect(res.versionNumber).toBe(4);
  });

  it("문서 미존재 시 NotFoundError + outcome=failure", async () => {
    const m = makeMocks({ documentExists: false });
    const useCase = new VersionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    await expect(useCase.create(command)).rejects.toMatchObject({
      name: "NotFoundError",
    });
    expect(m.calls).toContain("logger.error:failure");
  });

  it("outbox 페이로드는 documentId/versionNumber/contentRef 포함", async () => {
    const m = makeMocks();
    const useCase = new VersionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    await useCase.create(command);
    expect(m.outboxRecords[0].payload).toMatchObject({
      documentId: "doc_001",
      versionNumber: 1,
      contentRef: "s3://bucket/k1",
    });
  });
});
