// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { DepartmentUseCase } from './department.use-case.js';
import { DepartmentEntity } from '../../domain/index.js';
import type { DepartmentRepositoryPort } from '../ports/department-repository.port.js';
import type {
  DepartmentOutboxPort,
  DepartmentOutboxRecord,
} from '../ports/department-outbox.port.js';
import type {
  DepartmentTransactionPort,
  DepartmentTransactionScope,
} from '../ports/department-transaction.port.js';
import type { DepartmentLoggerPort } from '../ports/department-logger.port.js';

function makeMocks() {
  const calls: string[] = [];
  const scope: DepartmentTransactionScope = { id: 'tx-1', startedAt: new Date() };
  const transaction: DepartmentTransactionPort = {
    async run<T>(_n: string, w: (s: DepartmentTransactionScope) => Promise<T>): Promise<T> {
      calls.push('transaction.run.start');
      const r = await w(scope);
      calls.push('transaction.run.commit');
      return r;
    },
  };
  const repository: DepartmentRepositoryPort = {
    save: vi.fn(async () => {
      calls.push('repository.save');
    }),
    findById: vi.fn(async () => null),
    list: vi.fn(async () => []),
    resolveChain: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push('repository.delete');
    }),
  };
  const outboxRecords: DepartmentOutboxRecord[] = [];
  const outbox: DepartmentOutboxPort = {
    append: vi.fn(async (r: DepartmentOutboxRecord) => {
      calls.push('outbox.append');
      outboxRecords.push(r);
    }),
  };
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: DepartmentLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${ctx.outcome ?? 'started'}`);
      logged.push({ level: 'info', ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: 'warn', ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? '?'}`);
      logged.push({ level: 'error', ctx: ctx as never, msg });
    },
  };
  return { transaction, repository, outbox, outboxRecords, logger, logged, calls };
}

describe('DepartmentUseCase.create', () => {
  it('transaction wrapping + outbox(department.created)', async () => {
    const m = makeMocks();
    const uc = new DepartmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.create({ id: 'dept_1', name: 'Eng' });
    expect(m.calls).toEqual([
      'logger.info:started',
      'transaction.run.start',
      'repository.save',
      'outbox.append',
      'transaction.run.commit',
      'logger.info:success',
    ]);
    expect(m.outboxRecords[0]).toMatchObject({
      eventName: 'auth.department.created',
      eventVersion: 1,
    });
  });
});

describe('DepartmentUseCase.update', () => {
  it('미존재 시 NotFoundError', async () => {
    const m = makeMocks();
    const uc = new DepartmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(uc.update({ id: 'missing', patch: { name: 'X' } })).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });

  it('자기 자신을 parent 로 두면 ConflictError (cycle)', async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      DepartmentEntity.create({ id: 'd_self', name: 'X' }),
    );
    const uc = new DepartmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(uc.update({ id: 'd_self', patch: { parentId: 'd_self' } })).rejects.toMatchObject({
      name: 'ConflictError',
    });
  });

  it('descendant 를 parent 로 두면 cycle 검출', async () => {
    const m = makeMocks();
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      DepartmentEntity.create({ id: 'd_root', name: 'Root' }),
    );
    // 새 parent 가 이미 d_root 를 ancestor 로 가짐 → cycle
    (m.repository.resolveChain as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      DepartmentEntity.create({ id: 'd_descendant', name: 'Desc' }),
      DepartmentEntity.create({ id: 'd_root', name: 'Root' }),
    ]);
    const uc = new DepartmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      uc.update({ id: 'd_root', patch: { parentId: 'd_descendant' } }),
    ).rejects.toMatchObject({ name: 'ConflictError' });
  });
});

describe('DepartmentUseCase.delete', () => {
  it('repository.delete + outbox(department.deleted)', async () => {
    const m = makeMocks();
    const uc = new DepartmentUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.delete({ id: 'd_x' });
    expect(m.calls).toContain('repository.delete');
    expect(m.outboxRecords[0]).toMatchObject({ eventName: 'auth.department.deleted' });
  });
});
