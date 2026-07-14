// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

import { describe, it, expect } from 'vitest';
import { RoleRegistry } from './role-registry.js';
import { OrgRoleRegistry } from './org-role-registry.js';
import { RoleResolver } from './role-resolver.js';
import { hasBit } from 'weighted-index';

// ── 픽스처 ───────────────────────────────────────────────────────────────────

function buildFixture() {
  const roles = new RoleRegistry();

  // project 도메인
  roles.register({
    id: 'viewer',
    domain: 'project',
    parents: [],
    ownFeatures: ['page:dashboard', 'resource:read'],
  });
  roles.register({
    id: 'author',
    domain: 'project',
    parents: ['viewer'],
    ownFeatures: ['resource:write', 'api:create'],
  });
  roles.register({
    id: 'manager',
    domain: 'project',
    parents: ['author'],
    ownFeatures: ['action:approve', 'resource:delete'],
  });

  // billing 도메인
  roles.register({
    id: 'viewer',
    domain: 'billing',
    parents: [],
    ownFeatures: ['page:invoice', 'resource:invoice:read'],
  });
  roles.register({
    id: 'approver',
    domain: 'billing',
    parents: ['viewer'],
    ownFeatures: ['action:invoice:approve'],
  });

  const orgRoles = new OrgRoleRegistry();
  orgRoles.register({
    id: 'member',
    parents: [],
    ownAssignments: [
      { domain: 'project', role: 'viewer' },
      { domain: 'billing', role: 'viewer' },
    ],
  });
  orgRoles.register({
    id: 'team_lead',
    parents: ['member'],
    ownAssignments: [{ domain: 'project', role: 'author' }],
  });
  orgRoles.register({
    id: 'div_head',
    parents: ['team_lead'],
    ownAssignments: [
      { domain: 'project', role: 'manager' },
      { domain: 'billing', role: 'approver' },
    ],
  });

  return new RoleResolver(roles, orgRoles);
}

// ── RoleResolver ─────────────────────────────────────────────────────────────

describe('RoleResolver', () => {
  describe('check — org role 기반', () => {
    it('member는 project:resource:read 가능 (viewer 상속)', () => {
      const resolver = buildFixture();
      expect(
        resolver.check({ orgRoleId: 'member', directAssignments: [] }, 'project', 'resource:read'),
      ).toBe(true);
    });

    it('member는 project:resource:write 불가', () => {
      const resolver = buildFixture();
      expect(
        resolver.check({ orgRoleId: 'member', directAssignments: [] }, 'project', 'resource:write'),
      ).toBe(false);
    });

    it('team_lead는 project:resource:write 가능 (author 상속)', () => {
      const resolver = buildFixture();
      expect(
        resolver.check(
          { orgRoleId: 'team_lead', directAssignments: [] },
          'project',
          'resource:write',
        ),
      ).toBe(true);
    });

    it('team_lead는 project:action:approve 불가 (manager만)', () => {
      const resolver = buildFixture();
      expect(
        resolver.check(
          { orgRoleId: 'team_lead', directAssignments: [] },
          'project',
          'action:approve',
        ),
      ).toBe(false);
    });

    it('div_head는 project:action:approve 가능', () => {
      const resolver = buildFixture();
      expect(
        resolver.check(
          { orgRoleId: 'div_head', directAssignments: [] },
          'project',
          'action:approve',
        ),
      ).toBe(true);
    });

    it('div_head는 billing:action:invoice:approve 가능', () => {
      const resolver = buildFixture();
      expect(
        resolver.check(
          { orgRoleId: 'div_head', directAssignments: [] },
          'billing',
          'action:invoice:approve',
        ),
      ).toBe(true);
    });
  });

  describe('check — 직접 배정 기반', () => {
    it('직접 배정만으로 권한 부여', () => {
      const resolver = buildFixture();
      const ctx = { directAssignments: [{ domain: 'project', role: 'manager' }] };
      expect(resolver.check(ctx, 'project', 'action:approve')).toBe(true);
    });

    it('다른 도메인 직접 배정은 영향 없음', () => {
      const resolver = buildFixture();
      const ctx = { directAssignments: [{ domain: 'billing', role: 'approver' }] };
      expect(resolver.check(ctx, 'project', 'resource:write')).toBe(false);
    });
  });

  describe('check — 직접 배정 + org role 합산', () => {
    it('org role이 없는 도메인을 직접 배정으로 보완', () => {
      const resolver = buildFixture();
      const ctx = {
        orgRoleId: 'member', // member는 billing:viewer만
        directAssignments: [{ domain: 'billing', role: 'approver' }],
      };
      // org role: billing:viewer, direct: billing:approver → 합산
      expect(resolver.check(ctx, 'billing', 'action:invoice:approve')).toBe(true);
      expect(resolver.check(ctx, 'billing', 'resource:invoice:read')).toBe(true); // viewer 상속 포함
    });

    it('org role과 직접 배정이 같은 domain이면 OR 합산', () => {
      const resolver = buildFixture();
      const ctx = {
        orgRoleId: 'member', // project:viewer
        directAssignments: [{ domain: 'project', role: 'author' }], // project:author
      };
      // viewer의 권한 + author의 권한 모두
      expect(resolver.check(ctx, 'project', 'resource:read')).toBe(true);
      expect(resolver.check(ctx, 'project', 'resource:write')).toBe(true);
    });
  });

  describe('resolveDomainMask', () => {
    it('배정 없는 도메인은 빈 mask 반환', () => {
      const resolver = buildFixture();
      const { mask, featureIds } = resolver.resolveDomainMask({ directAssignments: [] }, 'project');
      expect(featureIds.length).toBe(0);
      expect(mask.length).toBe(0);
    });

    it('mask로 직접 hasBit 체크 가능', () => {
      const resolver = buildFixture();
      const ctx = { orgRoleId: 'team_lead', directAssignments: [] };
      const { mask, featureIds } = resolver.resolveDomainMask(ctx, 'project');

      const idx = featureIds.indexOf('resource:write');
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(hasBit(mask, idx)).toBe(true);

      const idx2 = featureIds.indexOf('action:approve');
      expect(idx2).toBeGreaterThanOrEqual(0);
      expect(hasBit(mask, idx2)).toBe(false);
    });

    it('featureIds는 정렬되어 있다', () => {
      const resolver = buildFixture();
      const { featureIds } = resolver.resolveDomainMask(
        { orgRoleId: 'team_lead', directAssignments: [] },
        'project',
      );
      expect(featureIds).toEqual([...featureIds].toSorted());
    });
  });

  describe('accessibleDomains', () => {
    it('org role이 배정된 도메인 목록 반환', () => {
      const resolver = buildFixture();
      const domains = resolver.accessibleDomains({ orgRoleId: 'member', directAssignments: [] });
      expect(domains).toContain('project');
      expect(domains).toContain('billing');
    });

    it('직접 배정 도메인도 포함', () => {
      const resolver = buildFixture();
      const domains = resolver.accessibleDomains({
        directAssignments: [{ domain: 'admin', role: 'superuser' }],
      });
      expect(domains).toContain('admin');
    });

    it('중복 없이 반환', () => {
      const resolver = buildFixture();
      const domains = resolver.accessibleDomains({
        orgRoleId: 'member',
        directAssignments: [{ domain: 'project', role: 'author' }],
      });
      const projectCount = domains.filter((d) => d === 'project').length;
      expect(projectCount).toBe(1);
    });
  });

  describe('explain — 권한 출처 추적', () => {
    it('direct 배정 출처를 추적한다', () => {
      const resolver = buildFixture();
      const ctx = { directAssignments: [{ domain: 'project', role: 'author' }] };
      const entries = resolver.explain(ctx, 'project', 'resource:write');
      expect(entries.length).toBe(1);
      expect(entries[0].grantedBy.source).toBe('direct');
      expect(entries[0].grantedBy.role).toBe('author');
    });

    it('org-role 출처를 추적한다', () => {
      const resolver = buildFixture();
      const ctx = { orgRoleId: 'team_lead', directAssignments: [] };
      const entries = resolver.explain(ctx, 'project', 'resource:write');
      expect(entries.length).toBe(1);
      expect(entries[0].grantedBy.source).toBe('org-role');
      expect(entries[0].grantedBy.role).toBe('author');
    });

    it('권한 없으면 빈 배열', () => {
      const resolver = buildFixture();
      const ctx = { orgRoleId: 'member', directAssignments: [] };
      expect(resolver.explain(ctx, 'project', 'action:approve')).toEqual([]);
    });

    it('direct와 org-role이 겹치면 direct는 한 번만 보고', () => {
      const resolver = buildFixture();
      const ctx = {
        orgRoleId: 'team_lead', // project:author 포함
        directAssignments: [{ domain: 'project', role: 'author' }], // 동일
      };
      const entries = resolver.explain(ctx, 'project', 'resource:write');
      // direct에서 1개만 (org-role의 author는 중복으로 skip)
      expect(entries.filter((e) => e.grantedBy.role === 'author').length).toBe(1);
    });
  });

  describe('org role 없이 동작', () => {
    it('orgRoleId 미지정 시 direct 배정만 사용', () => {
      const resolver = buildFixture();
      const ctx = { directAssignments: [{ domain: 'project', role: 'viewer' }] };
      expect(resolver.check(ctx, 'project', 'page:dashboard')).toBe(true);
      expect(resolver.check(ctx, 'project', 'resource:write')).toBe(false);
    });
  });
});
