// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { RoleAssignmentUseCase } from './role-assignment.use-case.js';
import type { RoleAssignmentRepositoryPort } from '../ports/role-assignment-repository.port.js';
import type {
  RoleAssignmentOutboxPort,
  RoleAssignmentOutboxRecord,
} from '../ports/role-assignment-outbox.port.js';
import type {
  RoleAssignmentTransactionPort,
  RoleAssignmentTransactionScope,
} from '../ports/role-assignment-transaction.port.js';
import type { RoleAssignmentLoggerPort } from '../ports/role-assignment-logger.port.js';
import type { RoleQueryPort } from '../ports/role-query.port.js';
import type { PermissionChangePublisherPort } from '../ports/permission-change-publisher.port.js';

function makeMocks(opts: { roleExists?: boolean } = {}) {
  const calls: string[] = [];
  const scope: RoleAssignmentTransactionScope = { id: 'tx-1', startedAt: new Date() };
  const transaction: RoleAssignmentTransactionPort = {
    async run<T>(_n: string, w: (s: RoleAssignmentTransactionScope) => Promise<T>): Promise<T> {
      calls.push('transaction.run.start');
      const r = await w(scope);
      calls.push('transaction.run.commit');
      return r;
    },
  };
  const repository: RoleAssignmentRepositoryPort = {
    save: vi.fn(async () => {
      calls.push('repository.save');
    }),
    findOne: vi.fn(async () => null),
    listForUser: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push('repository.delete');
    }),
  };
  const outboxRecords: RoleAssignmentOutboxRecord[] = [];
  const outbox: RoleAssignmentOutboxPort = {
    append: vi.fn(async (r: RoleAssignmentOutboxRecord) => {
      calls.push('outbox.append');
      outboxRecords.push(r);
    }),
  };
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: RoleAssignmentLoggerPort = {
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
  const roleQuery: RoleQueryPort = {
    roleExists: vi.fn(async () => opts.roleExists ?? true),
  };
  const publishCalls: Array<{ userId: string; reason: string }> = [];
  const permissionPublisher: PermissionChangePublisherPort = {
    publishUserChange: vi.fn(async (userId: string, reason: 'permission_change') => {
      calls.push('publisher.publish');
      publishCalls.push({ userId, reason });
    }),
  };
  return {
    transaction,
    repository,
    outbox,
    outboxRecords,
    logger,
    logged,
    calls,
    roleQuery,
    permissionPublisher,
    publishCalls,
  };
}

describe('RoleAssignmentUseCase.assign', () => {
  it('transaction wrapping + outbox(role-assignment.assigned) + publisher 호출', async () => {
    const m = makeMocks();
    const uc = new RoleAssignmentUseCase(m);
    await uc.assign({ userId: 'u1', roleId: 'r1', scopeType: 'global', scopeId: null });
    expect(m.calls).toContain('transaction.run.start');
    expect(m.calls).toContain('repository.save');
    expect(m.calls).toContain('outbox.append');
    expect(m.calls).toContain('publisher.publish');
    expect(m.publishCalls).toEqual([{ userId: 'u1', reason: 'permission_change' }]);
    expect(m.outboxRecords[0]).toMatchObject({
      eventName: 'auth.role-assignment.assigned',
      eventVersion: 1,
    });
  });

  it('role 미존재 → NotFoundError, save/outbox 호출 없음', async () => {
    const m = makeMocks({ roleExists: false });
    const uc = new RoleAssignmentUseCase(m);
    await expect(
      uc.assign({ userId: 'u1', roleId: 'missing', scopeType: 'global', scopeId: null }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(m.calls).not.toContain('repository.save');
  });

  it('publisher 실패 시 warn 로그 후 정상 응답 (fail-open)', async () => {
    const m = makeMocks();
    (m.permissionPublisher.publishUserChange as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('redis-down'),
    );
    const uc = new RoleAssignmentUseCase(m);
    await expect(
      uc.assign({ userId: 'u1', roleId: 'r1', scopeType: 'global', scopeId: null }),
    ).resolves.toMatchObject({ status: 'ASSIGNED' });
    expect(m.logged.some((l) => l.level === 'warn')).toBe(true);
  });
});

describe('RoleAssignmentUseCase.revoke', () => {
  it('repository.delete + outbox(role-assignment.revoked) + publisher 호출', async () => {
    const m = makeMocks();
    const uc = new RoleAssignmentUseCase(m);
    await uc.revoke({ userId: 'u1', roleId: 'r1', scopeType: 'global', scopeId: null });
    expect(m.calls).toContain('repository.delete');
    expect(m.calls).toContain('publisher.publish');
    expect(m.outboxRecords[0]).toMatchObject({ eventName: 'auth.role-assignment.revoked' });
  });
});
