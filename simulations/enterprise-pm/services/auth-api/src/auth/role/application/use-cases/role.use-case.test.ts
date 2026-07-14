// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { RoleUseCase } from './role.use-case.js';
import { RoleEntity } from '../../domain/index.js';
import type { RoleRepositoryPort } from '../ports/role-repository.port.js';
import type { RoleOutboxPort, RoleOutboxRecord } from '../ports/role-outbox.port.js';
import type { RoleTransactionPort, RoleTransactionScope } from '../ports/role-transaction.port.js';
import type { RoleLoggerPort } from '../ports/role-logger.port.js';

function makeMocks() {
  const calls: string[] = [];
  const scope: RoleTransactionScope = { id: 'tx-1', startedAt: new Date() };
  const transaction: RoleTransactionPort = {
    async run<T>(_n: string, w: (s: RoleTransactionScope) => Promise<T>): Promise<T> {
      calls.push('transaction.run.start');
      const r = await w(scope);
      calls.push('transaction.run.commit');
      return r;
    },
  };
  const repository: RoleRepositoryPort = {
    save: vi.fn(async () => {
      calls.push('repository.save');
    }),
    findById: vi.fn(async () => null),
    findByName: vi.fn(async () => null),
    list: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push('repository.delete');
    }),
  };
  const outboxRecords: RoleOutboxRecord[] = [];
  const outbox: RoleOutboxPort = {
    append: vi.fn(async (r: RoleOutboxRecord) => {
      calls.push('outbox.append');
      outboxRecords.push(r);
    }),
  };
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: RoleLoggerPort = {
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

describe('RoleUseCase.create', () => {
  const command = {
    id: 'role_admin',
    name: 'admin',
    scopeType: 'global' as const,
    defaultMaskHex: 'ffff',
    traceId: 'trc',
    correlationId: 'cor',
  };

  it('transaction wrapping + outbox(auth.role.created)', async () => {
    const m = makeMocks();
    const uc = new RoleUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.create(command);
    expect(m.calls).toEqual([
      'logger.info:started',
      'transaction.run.start',
      'repository.save',
      'outbox.append',
      'transaction.run.commit',
      'logger.info:success',
    ]);
    expect(m.outboxRecords[0]).toMatchObject({ eventName: 'auth.role.created', eventVersion: 1 });
    expect(typeof m.outboxRecords[0].idempotencyKey).toBe('string');
    expect(m.outboxRecords[0].idempotencyKey.length).toBeGreaterThan(0);
  });

  it('이미 존재하는 name 이면 ConflictError', async () => {
    const m = makeMocks();
    (m.repository.findByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      RoleEntity.create({ id: 'r_dup', name: 'admin', scopeType: 'global', defaultMaskHex: 'ff' }),
    );
    const uc = new RoleUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(uc.create(command)).rejects.toMatchObject({ name: 'ConflictError' });
  });
});

describe('RoleUseCase.delete', () => {
  it('repository.delete + outbox(auth.role.deleted)', async () => {
    const m = makeMocks();
    const uc = new RoleUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await uc.delete({ id: 'role_x' });
    expect(m.calls).toContain('repository.delete');
    expect(m.outboxRecords[0]).toMatchObject({ eventName: 'auth.role.deleted' });
    expect(typeof m.outboxRecords[0].idempotencyKey).toBe('string');
  });
});
