// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { IssuerBitmapReadModel } from './bitmap-issue.read-model.js';
import { AUTH_BITMASK_BYTES } from '../codec/auth-codec.js';
import type { UserQueryPort } from '../../application/ports/user-query.port.js';
import type { RoleAssignmentQueryPort } from '../../application/ports/role-assignment-query.port.js';
import type { RoleQueryPort } from '../../application/ports/role-query.port.js';

const SECRET = new TextEncoder().encode('test-secret-32bytes-long-enough-1234');

function deps(opts: {
  user?: { id: string } | null;
  assignments?: Array<{
    userId: string;
    roleId: string;
    scopeType: string;
    scopeId: string | null;
  }>;
  roles?: Map<
    string,
    {
      id: string;
      name: string;
      scopeType: 'global' | 'department' | 'project';
      defaultMaskHex: string;
    }
  >;
}) {
  const userQuery: UserQueryPort = { findById: vi.fn(async () => opts.user ?? null) };
  const roleAssignmentQuery: RoleAssignmentQueryPort = {
    listForUser: vi.fn(async () => opts.assignments ?? []),
  };
  const roleQuery: RoleQueryPort = {
    findById: vi.fn(async (rid: string) => opts.roles?.get(rid) ?? null),
  };
  return { userQuery, roleAssignmentQuery, roleQuery };
}

describe('IssuerBitmapReadModel', () => {
  it('user 없으면 null', async () => {
    const d = deps({ user: null });
    const rm = new IssuerBitmapReadModel(d.userQuery, d.roleAssignmentQuery, d.roleQuery, {
      secret: SECRET,
      ttlMs: 3600_000,
      issuer: 'sim-auth-api',
    });
    expect(await rm.issueForUser('missing')).toBeNull();
  });

  it('user 있고 assignment 없음 → mask 모두 0', async () => {
    const d = deps({ user: { id: 'u1' } });
    const rm = new IssuerBitmapReadModel(d.userQuery, d.roleAssignmentQuery, d.roleQuery, {
      secret: SECRET,
      ttlMs: 3600_000,
      issuer: 'sim-auth-api',
    });
    const bm = await rm.issueForUser('u1');
    expect(bm).not.toBeNull();
    expect(bm!.mask.length).toBe(AUTH_BITMASK_BYTES);
    for (const b of bm!.mask) expect(b).toBe(0);
  });

  it('global admin role 부여 → mask 전부 set', async () => {
    const adminMaskHex = 'ff'.repeat(AUTH_BITMASK_BYTES);
    const d = deps({
      user: { id: 'u1' },
      assignments: [{ userId: 'u1', roleId: 'r_admin', scopeType: 'global', scopeId: null }],
      roles: new Map([
        [
          'r_admin',
          { id: 'r_admin', name: 'admin', scopeType: 'global', defaultMaskHex: adminMaskHex },
        ],
      ]),
    });
    const rm = new IssuerBitmapReadModel(d.userQuery, d.roleAssignmentQuery, d.roleQuery, {
      secret: SECRET,
      ttlMs: 3600_000,
      issuer: 'sim-auth-api',
    });
    const bm = await rm.issueForUser('u1');
    expect(bm).not.toBeNull();
    for (const b of bm!.mask) expect(b).toBe(0xff);
  });

  it("발급된 bitmap 은 prefix='sim.bitmap' + signature 포함", async () => {
    const d = deps({ user: { id: 'u1' } });
    const rm = new IssuerBitmapReadModel(d.userQuery, d.roleAssignmentQuery, d.roleQuery, {
      secret: SECRET,
      ttlMs: 3600_000,
      issuer: 'sim-auth-api',
    });
    const bm = await rm.issueForUser('u1');
    expect(bm!.prefix).toBe('sim.bitmap');
    expect(bm!.v).toBeTruthy();
    expect(bm!.signature).toMatch(/^[0-9a-f]+$/);
    expect(new Date(bm!.expiresAt).getTime() > new Date(bm!.issuedAt).getTime()).toBe(true);
  });
});
