// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { TimeOffUseCase } from "./timeoff.use-case.js";
import { TimeOffEntity } from "../../domain/index.js";
import type { TimeOffRepositoryPort } from "../ports/timeoff-repository.port.js";
import type {
  TimeOffOutboxPort,
  TimeOffOutboxRecord,
} from "../ports/timeoff-outbox.port.js";
import type {
  TimeOffTransactionPort,
  TimeOffTransactionScope,
} from "../ports/timeoff-transaction.port.js";
import type { TimeOffLoggerPort } from "../ports/timeoff-logger.port.js";

function makeMocks(initial?: TimeOffEntity) {
  const calls: string[] = [];
  const scope: TimeOffTransactionScope = { id: "tx", startedAt: new Date() };
  const transaction: TimeOffTransactionPort = {
    async run<T>(_n: string, w: (s: TimeOffTransactionScope) => Promise<T>): Promise<T> {
      calls.push("transaction.run.start");
      const r = await w(scope);
      calls.push("transaction.run.commit");
      return r;
    },
  };
  let stored: TimeOffEntity | null = initial ?? null;
  const repository: TimeOffRepositoryPort = {
    save: vi.fn(async (e: TimeOffEntity) => {
      calls.push("repository.save");
      stored = e;
    }),
    findById: vi.fn(async () => stored),
  };
  const outboxRecords: TimeOffOutboxRecord[] = [];
  const outbox: TimeOffOutboxPort = {
    append: vi.fn(async (r: TimeOffOutboxRecord) => {
      calls.push("outbox.append");
      outboxRecords.push(r);
    }),
  };
  const logger: TimeOffLoggerPort = { info: () => {}, warn: () => {}, error: () => {} };
  return { transaction, repository, outbox, outboxRecords, logger, calls };
}

describe("TimeOffUseCase", () => {
  it("create: tx + save + outbox", async () => {
    const m = makeMocks();
    const uc = new TimeOffUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.create({
      id: "tof_1",
      requesterId: "u",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      reason: "vacation",
    });
    expect(m.outboxRecords[0].eventName).toBe("approval.time-off.submitted");
    expect(m.outboxRecords[0].idempotencyKey).toMatch(
      /^tof-1:approval\.time-off\.submitted:\d+$/,
    );
  });

  it("updateStatus: 미존재 → TimeOffNotFoundException", async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const uc = new TimeOffUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(uc.updateStatus({ id: "missing", status: "submitted" })).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });
});
