// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { AuthenticateUseCase } from './authenticate.use-case.js';
import { TestCredentialStore } from '../ports/credential-store.port.js';
import type { UserQueryPort } from '../ports/user-query.port.js';
import type { RoleAssignmentQueryPort } from '../ports/role-assignment-query.port.js';
import type { RoleQueryPort } from '../ports/role-query.port.js';
import type { AuthenticateLoggerPort } from '../ports/authenticate-logger.port.js';

function deps(
  opts: {
    user?: {
      id: string;
      email: string;
      displayName: string;
      departmentId: string | null;
      primaryRoleId: string | null;
    } | null;
    assignments?: Array<{
      userId: string;
      roleId: string;
      scopeType: string;
      scopeId: string | null;
    }>;
    roles?: Map<string, { id: string; name: string }>;
    password?: string;
  } = {},
) {
  const userQuery: UserQueryPort = {
    findByEmail: vi.fn(async () => opts.user ?? null),
  };
  const roleAssignmentQuery: RoleAssignmentQueryPort = {
    listForUser: vi.fn(async () => opts.assignments ?? []),
  };
  const roleQuery: RoleQueryPort = {
    findById: vi.fn(async (rid: string) => opts.roles?.get(rid) ?? null),
  };
  const credentialStore = new TestCredentialStore();
  if (opts.user && opts.password) credentialStore.set(opts.user.email, opts.password);
  const logged: Array<{ level: string; msg: string }> = [];
  const logger: AuthenticateLoggerPort = {
    info: (_ctx, msg) => logged.push({ level: 'info', msg }),
    warn: (_ctx, msg) => logged.push({ level: 'warn', msg }),
    error: (_ctx, msg) => logged.push({ level: 'error', msg }),
  };
  return { userQuery, roleAssignmentQuery, roleQuery, credentialStore, logger, logged };
}

describe('AuthenticateUseCase', () => {
  it('성공 — userId + roleIds + roleAssignments 반환', async () => {
    const d = deps({
      user: {
        id: 'u_alice',
        email: 'alice@x.com',
        displayName: 'Alice',
        departmentId: 'd_eng',
        primaryRoleId: 'r_manager',
      },
      assignments: [
        { userId: 'u_alice', roleId: 'r_manager', scopeType: 'department', scopeId: 'd_eng' },
      ],
      roles: new Map([['r_manager', { id: 'r_manager', name: 'manager' }]]),
      password: 'alice-pass',
    });
    const uc = new AuthenticateUseCase(d);
    const session = await uc.authenticate({ email: 'alice@x.com', password: 'alice-pass' });
    expect(session.userId).toBe('u_alice');
    expect(session.roleIds).toEqual(['r_manager']);
    expect(session.roleNames).toEqual(['manager']);
    expect(session.roleAssignments[0].roleName).toBe('manager');
  });

  it('user 미존재 → UnauthorizedError', async () => {
    const d = deps({ user: null });
    const uc = new AuthenticateUseCase(d);
    await expect(uc.authenticate({ email: 'x@x', password: 'p' })).rejects.toMatchObject({
      name: 'UnauthorizedError',
    });
  });

  it('password 불일치 → UnauthorizedError', async () => {
    const d = deps({
      user: {
        id: 'u1',
        email: 'alice@x',
        displayName: 'A',
        departmentId: null,
        primaryRoleId: null,
      },
      password: 'right',
    });
    const uc = new AuthenticateUseCase(d);
    await expect(uc.authenticate({ email: 'alice@x', password: 'wrong' })).rejects.toMatchObject({
      name: 'UnauthorizedError',
    });
  });

  it('빈 email → ValidationError', async () => {
    const d = deps();
    const uc = new AuthenticateUseCase(d);
    await expect(uc.authenticate({ email: ' ', password: 'x' })).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('role lookup 실패 시 해당 role 만 누락되고 나머지는 보존', async () => {
    const d = deps({
      user: { id: 'u1', email: 'u1@x', displayName: 'U1', departmentId: null, primaryRoleId: null },
      assignments: [
        { userId: 'u1', roleId: 'r1', scopeType: 'global', scopeId: null },
        { userId: 'u1', roleId: 'r_missing', scopeType: 'global', scopeId: null },
      ],
      roles: new Map([['r1', { id: 'r1', name: 'admin' }]]),
      password: 'p',
    });
    const uc = new AuthenticateUseCase(d);
    const session = await uc.authenticate({ email: 'u1@x', password: 'p' });
    expect(session.roleAssignments.map((r) => r.roleId)).toEqual(['r1']);
  });
});
