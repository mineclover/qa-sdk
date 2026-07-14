// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * auth-integration.test.ts — Auth × Permission 통합 시나리오
 *
 * 전체 흐름:
 *   로그인 → TokenEnrichmentHandler.enrich() → JWT claims
 *   요청 → PermissionMiddleware.check() → O(1) 판정
 *   권한 변경 → PermissionChangeNotifier.notify() → 버전 bump
 *   재요청 → VERSION_MISMATCH → 토큰 재발급 강제
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleRegistry } from './role-registry.js';
import { OrgRoleRegistry } from './org-role-registry.js';
import { RoleResolver } from './role-resolver.js';
import { UserOverrideStore } from './user-override.js';
import { UserPermissionEngine } from './user-permission-engine.js';
import { InMemoryPermissionVersionStore } from './permission-version.js';
import { NoopAuthProvider } from './auth-provider.js';
import { PermissionChangeNotifier } from './permission-change-notifier.js';
import { TokenEnrichmentHandler, computeSchemaHash } from './token-enrichment.js';
import { PermissionMiddleware } from './permission-middleware.js';
import type { PermissionClaims } from './token-enrichment.js';

// ── 픽스처 ───────────────────────────────────────────────────────────────────

function buildSystem() {
  const roles = new RoleRegistry();
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

  const overrides = new UserOverrideStore();
  const resolver = new RoleResolver(roles, orgRoles);
  const engine = new UserPermissionEngine(resolver, overrides);
  const versionStore = new InMemoryPermissionVersionStore();
  const provider = new NoopAuthProvider();
  const notifier = new PermissionChangeNotifier(versionStore, provider);

  const enricher = new TokenEnrichmentHandler(engine, roles, versionStore, async (userId) => {
    // 테스트용 컨텍스트 로더: userId 접두사로 org role 결정
    if (userId.startsWith('member-')) return { orgRoleId: 'member', directAssignments: [] };
    if (userId.startsWith('teamlead-')) return { orgRoleId: 'team_lead', directAssignments: [] };
    if (userId.startsWith('divhead-')) return { orgRoleId: 'div_head', directAssignments: [] };
    return { directAssignments: [] };
  });

  const middleware = new PermissionMiddleware(roles, versionStore);

  return { roles, orgRoles, overrides, engine, versionStore, notifier, enricher, middleware };
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

async function issueToken(
  enricher: TokenEnrichmentHandler,
  userId: string,
): Promise<PermissionClaims & { sub: string }> {
  const claims = await enricher.enrich(userId);
  return { sub: userId, ...claims };
}

// ── 시나리오 ─────────────────────────────────────────────────────────────────

describe('Auth × Permission 통합 시나리오', () => {
  describe('로그인 → 토큰 발급 → 권한 체크', () => {
    it('member: 토큰 발급 시 project/billing bitmask 포함', async () => {
      const { enricher } = buildSystem();
      const claims = await enricher.enrich('member-alice');

      expect(claims.perms['project']).toBeDefined();
      expect(claims.perms['billing']).toBeDefined();
      expect(typeof claims.perms_v).toBe('number');
      expect(typeof claims.perms_schema).toBe('string');
    });

    it('미들웨어: 유효한 토큰으로 권한 체크 → ok', async () => {
      const { enricher, middleware } = buildSystem();
      const token = await issueToken(enricher, 'teamlead-bob');

      const result = await middleware.check(token, 'project', 'resource:write');
      expect(result.ok).toBe(true);
    });

    it('미들웨어: 권한 없는 feature → ok:false (DB 조회 없음)', async () => {
      const { enricher, middleware } = buildSystem();
      const token = await issueToken(enricher, 'member-carol');

      const result = await middleware.check(token, 'project', 'resource:write');
      expect(result.ok).toBe(false);
      expect((result as any).error.kind).toBe('PERMISSION_DENIED');
    });
  });

  describe('권한 변경 → 버전 bump → 토큰 소프트 만료', () => {
    it('notify() 후 구 토큰은 VERSION_MISMATCH', async () => {
      const { enricher, middleware, notifier } = buildSystem();

      // 1. 토큰 발급 (perms_v = 0)
      const oldToken = await issueToken(enricher, 'teamlead-dave');
      expect(oldToken.perms_v).toBe(0);

      // 2. 권한 변경 (버전 bump)
      await notifier.notify('teamlead-dave');

      // 3. 구 토큰으로 요청 → VERSION_MISMATCH
      const result = await middleware.check(oldToken, 'project', 'resource:write');
      expect(result.ok).toBe(false);
      expect((result as any).error.kind).toBe('VERSION_MISMATCH');
    });

    it('재발급 후 새 토큰은 정상 동작', async () => {
      const { enricher, middleware, notifier } = buildSystem();

      const oldToken = await issueToken(enricher, 'teamlead-eve');
      await notifier.notify('teamlead-eve');

      // 재발급 (새 perms_v 포함)
      const newToken = await issueToken(enricher, 'teamlead-eve');
      expect(newToken.perms_v).toBe(1); // bump 반영

      const result = await middleware.check(newToken, 'project', 'resource:write');
      expect(result.ok).toBe(true);
    });
  });

  describe('override 적용 → 버전 bump → 토큰 만료 흐름', () => {
    it('override 추가 → notify → 재발급 → 새 토큰에 override 반영', async () => {
      const { enricher, middleware, notifier, overrides } = buildSystem();
      const userId = 'teamlead-frank';

      // 발급: resource:write 있음
      const token1 = await issueToken(enricher, userId);
      const check1 = await middleware.check(token1, 'project', 'resource:write');
      expect(check1.ok).toBe(true);

      // override 적용 + 버전 bump
      overrides.deny(userId, 'project', 'resource:write');
      await notifier.notify(userId);

      // 구 토큰 → VERSION_MISMATCH
      const check2 = await middleware.check(token1, 'project', 'resource:write');
      expect((check2 as any).error.kind).toBe('VERSION_MISMATCH');

      // 재발급 → override 반영된 새 bitmask
      const token2 = await issueToken(enricher, userId);
      const check3 = await middleware.check(token2, 'project', 'resource:write');
      expect(check3.ok).toBe(false); // override 적용됨
    });
  });

  describe('hardRevoke — provider 세션 취소', () => {
    it('hardRevoke=true 시 provider.revokeUserSessions 호출', async () => {
      const { notifier, versionStore } = buildSystem();

      // provider mock
      const mockProvider = { id: 'mock', revokeUserSessions: vi.fn().mockResolvedValue(undefined) };
      const hardNotifier = new PermissionChangeNotifier(versionStore, mockProvider);

      const result = await hardNotifier.notify('user-999', { hardRevoke: true });
      expect(result.hardRevoked).toBe(true);
      expect(mockProvider.revokeUserSessions).toHaveBeenCalledWith('user-999');
    });

    it('hardRevoke=false (기본) 시 provider 호출 없음', async () => {
      const { notifier, versionStore } = buildSystem();
      const mockProvider = { id: 'mock', revokeUserSessions: vi.fn().mockResolvedValue(undefined) };
      const softNotifier = new PermissionChangeNotifier(versionStore, mockProvider);

      const result = await softNotifier.notify('user-000');
      expect(result.hardRevoked).toBe(false);
      expect(mockProvider.revokeUserSessions).not.toHaveBeenCalled();
    });

    it('notifyBatch: 여러 유저 동시 처리', async () => {
      const { notifier, versionStore } = buildSystem();
      const userIds = ['u1', 'u2', 'u3'];

      await notifier.notifyBatch(userIds);

      for (const id of userIds) {
        expect(await versionStore.getVersion(id)).toBe(1);
      }
    });
  });

  describe('schema 변경 → SCHEMA_MISMATCH', () => {
    it('새 feature 등록 즉시 구 토큰 무효 — refreshSchemaHash 불필요', async () => {
      const { roles, enricher, middleware } = buildSystem();
      const token = await issueToken(enricher, 'member-grace');

      // feature 추가 → registry 변경 즉시 hash 재계산
      roles.register({
        id: 'superadmin',
        domain: 'project',
        parents: ['manager'],
        ownFeatures: ['action:nuke'],
      });

      // refreshSchemaHash() 호출 없이도 SCHEMA_MISMATCH 발생
      const result = await middleware.check(token, 'project', 'resource:read');
      expect(result.ok).toBe(false);
      expect((result as any).error.kind).toBe('SCHEMA_MISMATCH');
    });

    it('schema 변경 없으면 구 토큰 유효', async () => {
      const { enricher, middleware } = buildSystem();
      const token = await issueToken(enricher, 'member-harry');

      // registry 변경 없음 → schema check 통과
      const result = await middleware.check(token, 'project', 'resource:read');
      expect(result.ok).toBe(true);
    });
  });

  describe('validate() + checkFromClaims() 분리 패턴', () => {
    it('한 요청에서 여러 feature 체크 시 validate 1회 + checkFromClaims 반복', async () => {
      const { enricher, middleware, versionStore } = buildSystem();
      const token = await issueToken(enricher, 'divhead-ivan');

      // validate 1회 (version DB 조회)
      const err = await middleware.validate(token);
      expect(err).toBeNull();

      // 이후 checkFromClaims는 DB 없음
      expect(middleware.checkFromClaims(token, 'project', 'page:dashboard').ok).toBe(true);
      expect(middleware.checkFromClaims(token, 'project', 'resource:write').ok).toBe(true);
      expect(middleware.checkFromClaims(token, 'project', 'action:approve').ok).toBe(true);
      expect(middleware.checkFromClaims(token, 'billing', 'action:invoice:approve').ok).toBe(true);
    });
  });

  describe('도메인 없는 토큰 클레임', () => {
    it('배정 없는 도메인 요청 → NO_DOMAIN_CLAIM', async () => {
      const { enricher, middleware } = buildSystem();
      const token = await issueToken(enricher, 'member-judy');
      // member는 "admin" 도메인 배정 없음

      const result = await middleware.check(token, 'admin', 'resource:read');
      expect(result.ok).toBe(false);
      expect((result as any).error.kind).toBe('NO_DOMAIN_CLAIM');
    });
  });

  describe('computeSchemaHash 결정론성', () => {
    it('같은 registry → 같은 hash', () => {
      const { roles } = buildSystem();
      const h1 = computeSchemaHash(roles);
      const h2 = computeSchemaHash(roles);
      expect(h1).toBe(h2);
    });

    it('다른 registry (feature 추가) → 다른 hash', () => {
      const { roles } = buildSystem();
      const h1 = computeSchemaHash(roles);
      roles.register({
        id: 'god',
        domain: 'project',
        parents: ['manager'],
        ownFeatures: ['action:everything'],
      });
      const h2 = computeSchemaHash(roles);
      expect(h1).not.toBe(h2);
    });
  });
});
