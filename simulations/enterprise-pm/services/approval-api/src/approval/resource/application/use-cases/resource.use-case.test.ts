// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { ResourceUseCase } from './resource.use-case.js';
import { ResourceEntity } from '../../domain/index.js';
import type { ResourceRepositoryPort } from '../ports/resource-repository.port.js';
import type { ResourceOutboxPort, ResourceOutboxRecord } from '../ports/resource-outbox.port.js';
import type {
  ResourceTransactionPort,
  ResourceTransactionScope,
} from '../ports/resource-transaction.port.js';
import type { ResourceLoggerPort } from '../ports/resource-logger.port.js';

function makeMocks(initial?: ResourceEntity) {
  const calls: string[] = [];
  const scope: ResourceTransactionScope = { id: 'tx', startedAt: new Date() };
  const transaction: ResourceTransactionPort = {
    async run<T>(_n: string, w: (s: ResourceTransactionScope) => Promise<T>): Promise<T> {
      calls.push('transaction.run.start');
      const r = await w(scope);
      calls.push('transaction.run.commit');
      return r;
    },
  };
  let stored: ResourceEntity | null = initial ?? null;
  const repository: ResourceRepositoryPort = {
    save: vi.fn(async (e: ResourceEntity) => {
      calls.push('repository.save');
      stored = e;
    }),
    findById: vi.fn(async () => stored),
  };
  const outboxRecords: ResourceOutboxRecord[] = [];
  const outbox: ResourceOutboxPort = {
    append: vi.fn(async (r: ResourceOutboxRecord) => {
      calls.push('outbox.append');
      outboxRecords.push(r);
    }),
  };
  const logger: ResourceLoggerPort = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  return { transaction, repository, outbox, outboxRecords, logger, calls };
}

describe('ResourceUseCase', () => {
  it('create: tx + save + outbox', async () => {
    const m = makeMocks();
    const uc = new ResourceUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.create({
      id: 'rsr_1',
      projectId: 'p',
      requesterId: 'u',
      resourceType: 'consultant',
      description: 'x',
    });
    expect(m.calls).toEqual([
      'transaction.run.start',
      'repository.save',
      'outbox.append',
      'transaction.run.commit',
    ]);
    expect(m.outboxRecords[0].eventName).toBe('approval.resource.submitted');
    expect(m.outboxRecords[0].idempotencyKey).toMatch(/^rsr-1:approval\.resource\.submitted:\d+$/);
  });

  it('updateStatus: 미존재 → ResourceNotFoundException', async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const uc = new ResourceUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(uc.updateStatus({ id: 'missing', status: 'submitted' })).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });
});
