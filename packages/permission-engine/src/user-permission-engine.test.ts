// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * user-permission-engine.test.ts
 *
 * 전체 파이프라인 시나리오 + 단위 검증:
 *   Role 계보 정의 → Org Role 배정 → 유저 컨텍스트 결합
 *   → role mask OR 합산 → user override AND NOT → 최종 판정
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { hasBit } from 'weighted-index';
import { RoleRegistry } from './role-registry.js';
import { OrgRoleRegistry } from './org-role-registry.js';
import { RoleResolver } from './role-resolver.js';
import { UserOverrideStore } from './user-override.js';
import { UserPermissionEngine } from './user-permission-engine.js';

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

function buildEngine() {
  const roles = new RoleRegistry();

  // project 도메인 계보
  //   viewer → author → manager
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
    ownFeatures: ['resource:write', 'api:project:POST'],
  });
  roles.register({
    id: 'manager',
    domain: 'project',
    parents: ['author'],
    ownFeatures: ['action:approve', 'resource:delete'],
  });

  // billing 도메인 계보
  //   viewer → approver
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

  const resolver = new RoleResolver(roles, orgRoles);
  const overrides = new UserOverrideStore();
  const engine = new UserPermissionEngine(resolver, overrides);

  return { roles, orgRoles, resolver, overrides, engine };
}

// ── 시나리오 테스트 ──────────────────────────────────────────────────────────

describe('전체 파이프라인 시나리오', () => {
  it('시나리오 A — member: role mask → 최종 mask 일치', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-alice';
    const ctx = { orgRoleId: 'member', directAssignments: [] };

    // override 없음 → role mask = final mask
    const result = engine.resolveFinalMask(userId, ctx, 'project');

    expect(result.roleGrantedFeatures).toContain('page:dashboard');
    expect(result.roleGrantedFeatures).toContain('resource:read');
    expect(result.roleGrantedFeatures).not.toContain('resource:write'); // author만

    expect(result.deniedFeatures).toHaveLength(0);
    expect(result.roleGrantedFeatures).toEqual(
      result.featureIds.filter((_, i) => hasBit(result.mask, i)),
    );
  });

  it('시나리오 B — team_lead: 다중 role OR 합산 검증', () => {
    const { engine } = buildEngine();
    const userId = 'user-bob';
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };

    // team_lead = member(viewer) + own(author) → project에서 viewer + author 합산
    expect(engine.check(userId, ctx, 'project', 'page:dashboard')).toBe(true); // viewer
    expect(engine.check(userId, ctx, 'project', 'resource:read')).toBe(true); // viewer
    expect(engine.check(userId, ctx, 'project', 'resource:write')).toBe(true); // author
    expect(engine.check(userId, ctx, 'project', 'api:project:POST')).toBe(true); // author
    expect(engine.check(userId, ctx, 'project', 'action:approve')).toBe(false); // manager만
    expect(engine.check(userId, ctx, 'project', 'resource:delete')).toBe(false); // manager만
  });

  it('시나리오 C — direct 배정 + org role 합산', () => {
    const { engine } = buildEngine();
    const userId = 'user-carol';
    const ctx = {
      orgRoleId: 'member', // project:viewer, billing:viewer
      directAssignments: [{ domain: 'billing', role: 'approver' }], // billing에 직접 추가
    };

    // billing: viewer(org) + approver(direct) → 합산
    expect(engine.check(userId, ctx, 'billing', 'page:invoice')).toBe(true);
    expect(engine.check(userId, ctx, 'billing', 'resource:invoice:read')).toBe(true);
    expect(engine.check(userId, ctx, 'billing', 'action:invoice:approve')).toBe(true);
  });

  it('시나리오 D — user override: 특정 feature 비활성화', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-dave';
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };

    // override 전: resource:write 있음
    expect(engine.check(userId, ctx, 'project', 'resource:write')).toBe(true);

    // override 적용
    overrides.deny(userId, 'project', 'resource:write');

    // override 후: resource:write 비활성화됨
    expect(engine.check(userId, ctx, 'project', 'resource:write')).toBe(false);

    // 다른 권한은 영향 없음
    expect(engine.check(userId, ctx, 'project', 'page:dashboard')).toBe(true);
    expect(engine.check(userId, ctx, 'project', 'resource:read')).toBe(true);
  });

  it('시나리오 E — override 해제 시 권한 복원', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-eve';
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };

    overrides.deny(userId, 'project', 'resource:write');
    expect(engine.check(userId, ctx, 'project', 'resource:write')).toBe(false);

    overrides.undeny(userId, 'project', 'resource:write');
    expect(engine.check(userId, ctx, 'project', 'resource:write')).toBe(true);
  });

  it('시나리오 F — 복수 feature 일괄 비활성화', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-frank';
    const ctx = { orgRoleId: 'div_head', directAssignments: [] };

    overrides.deny(userId, 'project', ['resource:write', 'action:approve', 'resource:delete']);

    expect(engine.check(userId, ctx, 'project', 'resource:write')).toBe(false);
    expect(engine.check(userId, ctx, 'project', 'action:approve')).toBe(false);
    expect(engine.check(userId, ctx, 'project', 'resource:delete')).toBe(false);

    // 비활성화 안 된 것들은 유지
    expect(engine.check(userId, ctx, 'project', 'page:dashboard')).toBe(true);
    expect(engine.check(userId, ctx, 'project', 'resource:read')).toBe(true);
  });
});

// ── audit — 권한 출처 분석 ────────────────────────────────────────────────────

describe('audit — 권한 출처 분석', () => {
  it('권한 있음: org-role 출처 반환', () => {
    const { engine } = buildEngine();
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };
    const result = engine.audit('user-x', ctx, 'project', 'resource:write');

    expect(result.granted).toBe(true);
    expect(result.denialReason).toBeNull();
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toBe('org-role');
    expect(result.sources[0].orgRoleId).toBe('team_lead');
    expect(result.sources[0].domainRole).toBe('author');
  });

  it('권한 있음: direct 배정 출처 반환', () => {
    const { engine } = buildEngine();
    const ctx = { directAssignments: [{ domain: 'project', role: 'manager' }] };
    const result = engine.audit('user-x', ctx, 'project', 'action:approve');

    expect(result.granted).toBe(true);
    expect(result.sources[0].source).toBe('direct');
    expect(result.sources[0].domainRole).toBe('manager');
  });

  it('권한 없음: not-assigned 이유', () => {
    const { engine } = buildEngine();
    const ctx = { orgRoleId: 'member', directAssignments: [] };
    const result = engine.audit('user-x', ctx, 'project', 'action:approve');

    expect(result.granted).toBe(false);
    expect(result.sources).toHaveLength(0);
    expect(result.denialReason).toEqual({ kind: 'not-assigned' });
  });

  it('권한 없음: user-override 이유 (role에서는 부여됐지만 차단됨)', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-y';
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };

    overrides.deny(userId, 'project', 'resource:write');
    const result = engine.audit(userId, ctx, 'project', 'resource:write');

    expect(result.granted).toBe(false);
    // role에서는 부여됐음
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].domainRole).toBe('author');
    // 하지만 user override로 차단
    expect(result.denialReason).toEqual({ kind: 'user-override' });
  });

  it('권한 없음: role도 없고 override도 있는 경우 → not-assigned', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-z';
    const ctx = { orgRoleId: 'member', directAssignments: [] };

    // member에게 없는 feature를 override로 추가해도 의미 없음
    overrides.deny(userId, 'project', 'action:approve');
    const result = engine.audit(userId, ctx, 'project', 'action:approve');

    expect(result.granted).toBe(false);
    expect(result.denialReason).toEqual({ kind: 'not-assigned' });
  });
});

// ── resolveFinalMask — 비트 레이어 검증 ──────────────────────────────────────

describe('resolveFinalMask — 비트 결합 검증', () => {
  it('role mask & ~deny_mask = final mask', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-bit';
    const ctx = { orgRoleId: 'div_head', directAssignments: [] };

    overrides.deny(userId, 'project', ['resource:delete', 'action:approve']);

    const result = engine.resolveFinalMask(userId, ctx, 'project');

    // role에서 부여됐지만 override로 제거된 것
    expect(result.roleGrantedFeatures).toContain('resource:delete');
    expect(result.roleGrantedFeatures).toContain('action:approve');
    expect(result.deniedFeatures).toContain('resource:delete');
    expect(result.deniedFeatures).toContain('action:approve');

    // final mask에는 없어야 함
    const deletedIdx = result.featureIds.indexOf('resource:delete');
    const approveIdx = result.featureIds.indexOf('action:approve');
    expect(hasBit(result.mask, deletedIdx)).toBe(false);
    expect(hasBit(result.mask, approveIdx)).toBe(false);

    // role에서 부여됐고 override 없는 것은 final mask에 있어야 함
    const readIdx = result.featureIds.indexOf('resource:read');
    expect(hasBit(result.mask, readIdx)).toBe(true);
  });

  it('override가 없으면 role mask = final mask (비트 단위 동일)', () => {
    const { resolver, overrides, engine } = buildEngine();
    const userId = 'user-clean';
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };

    const { mask: roleMask } = resolver.resolveDomainMask(ctx, 'project');
    const { mask: finalMask } = engine.resolveFinalMask(userId, ctx, 'project');

    expect(roleMask).toEqual(finalMask);
  });

  it('role 없는 도메인은 빈 mask 반환', () => {
    const { engine } = buildEngine();
    const result = engine.resolveFinalMask('user-none', { directAssignments: [] }, 'project');
    expect(result.mask.length).toBe(0);
    expect(result.featureIds).toHaveLength(0);
  });
});

// ── summarize — 도메인별 현황 ─────────────────────────────────────────────────

describe('summarize — 유저 권한 전체 현황', () => {
  it('접근 가능한 모든 도메인의 권한 요약을 반환한다', () => {
    const { engine } = buildEngine();
    const userId = 'user-summary';
    const ctx = { orgRoleId: 'team_lead', directAssignments: [] };

    const summary = engine.summarize(userId, ctx);

    expect(summary.has('project')).toBe(true);
    expect(summary.has('billing')).toBe(true);

    const project = summary.get('project')!;
    expect(project.granted).toContain('resource:write'); // team_lead
    expect(project.denied).toHaveLength(0);
  });

  it('override가 있으면 denied에 포함된다', () => {
    const { engine, overrides } = buildEngine();
    const userId = 'user-summary2';
    const ctx = { orgRoleId: 'div_head', directAssignments: [] };

    overrides.deny(userId, 'billing', 'action:invoice:approve');

    const summary = engine.summarize(userId, ctx);
    const billing = summary.get('billing')!;

    expect(billing.denied).toContain('action:invoice:approve');
    expect(billing.granted).not.toContain('action:invoice:approve');
    expect(billing.granted).toContain('resource:invoice:read'); // override 안 됨
  });
});

// ── UserOverrideStore 단위 테스트 ─────────────────────────────────────────────

describe('UserOverrideStore', () => {
  it('deny / isDenied / undeny 기본 동작', () => {
    const { overrides } = buildEngine();
    overrides.deny('u1', 'project', 'resource:write');
    expect(overrides.isDenied('u1', 'project', 'resource:write')).toBe(true);
    expect(overrides.isDenied('u1', 'project', 'resource:read')).toBe(false);

    overrides.undeny('u1', 'project', 'resource:write');
    expect(overrides.isDenied('u1', 'project', 'resource:write')).toBe(false);
  });

  it('deny는 멱등하다', () => {
    const { overrides } = buildEngine();
    overrides.deny('u1', 'project', 'resource:write');
    overrides.deny('u1', 'project', 'resource:write');
    expect(overrides.getDeniedFeatures('u1', 'project').size).toBe(1);
  });

  it('clearUser — 해당 유저 override 전체 제거', () => {
    const { overrides } = buildEngine();
    overrides.deny('u1', 'project', 'resource:write');
    overrides.deny('u1', 'billing', 'action:invoice:approve');
    overrides.clearUser('u1');
    expect(overrides.getDeniedFeatures('u1', 'project').size).toBe(0);
    expect(overrides.getDeniedFeatures('u1', 'billing').size).toBe(0);
  });

  it('clearUser(domain) — 특정 도메인만 제거', () => {
    const { overrides } = buildEngine();
    overrides.deny('u1', 'project', 'resource:write');
    overrides.deny('u1', 'billing', 'action:invoice:approve');
    overrides.clearUser('u1', 'project');
    expect(overrides.getDeniedFeatures('u1', 'project').size).toBe(0);
    expect(overrides.isDenied('u1', 'billing', 'action:invoice:approve')).toBe(true);
  });

  it('유저 간 override는 독립적이다', () => {
    const { overrides } = buildEngine();
    overrides.deny('u1', 'project', 'resource:write');
    expect(overrides.isDenied('u2', 'project', 'resource:write')).toBe(false);
  });

  it('toSnapshot / fromSnapshot 직렬화 왕복', () => {
    const { overrides } = buildEngine();
    overrides.deny('u1', 'project', ['resource:write', 'action:approve']);
    overrides.deny('u1', 'billing', 'action:invoice:approve');

    const snap = overrides.toSnapshot('u1');

    const restored = new UserOverrideStore();
    restored.fromSnapshot(snap);

    expect(restored.isDenied('u1', 'project', 'resource:write')).toBe(true);
    expect(restored.isDenied('u1', 'project', 'action:approve')).toBe(true);
    expect(restored.isDenied('u1', 'billing', 'action:invoice:approve')).toBe(true);
    expect(restored.isDenied('u1', 'project', 'resource:read')).toBe(false);
  });
});
