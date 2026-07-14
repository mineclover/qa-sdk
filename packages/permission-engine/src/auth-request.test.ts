// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * auth-request.test.ts — 권한 인증 요청 시나리오
 *
 * 실제 요청 흐름 시뮬레이션:
 *   HTTP 요청 → 세션에서 userId + 컨텍스트 추출
 *     → domain + feature 매핑
 *     → UserPermissionEngine.check()
 *     → 200 / 403
 *
 * 세션 구조 (서버가 토큰에서 복원):
 *   { userId, orgRoleId, directAssignments }
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoleRegistry } from './role-registry.js';
import { OrgRoleRegistry } from './org-role-registry.js';
import { RoleResolver } from './role-resolver.js';
import { UserOverrideStore } from './user-override.js';
import { UserPermissionEngine } from './user-permission-engine.js';
import type { ResolutionContext } from './role-resolver.js';

// ── 인프라: feature 매핑 테이블 ───────────────────────────────────────────────
//
// 실제 서비스에서는 라우터 미들웨어가 (method, path) → (domain, feature)를 매핑한다.
// 여기서는 간단한 레코드로 표현한다.

const ROUTE_PERMISSION: Record<string, { domain: string; feature: string }> = {
  'GET  /projects': { domain: 'project', feature: 'resource:read' },
  'GET  /projects/:id/dashboard': { domain: 'project', feature: 'page:dashboard' },
  'POST /projects': { domain: 'project', feature: 'api:project:POST' },
  'PUT  /projects/:id': { domain: 'project', feature: 'resource:write' },
  'DELETE /projects/:id': { domain: 'project', feature: 'resource:delete' },
  'POST /projects/:id/approve': { domain: 'project', feature: 'action:approve' },
  'GET  /invoices': { domain: 'billing', feature: 'resource:invoice:read' },
  'POST /invoices/:id/approve': { domain: 'billing', feature: 'action:invoice:approve' },
};

/** 미들웨어 역할: 요청이 허용되면 200, 거부되면 403 반환 */
function authorize(
  engine: UserPermissionEngine,
  session: { userId: string } & ResolutionContext,
  route: string,
): { status: 200 | 403; reason?: string } {
  const perm = ROUTE_PERMISSION[route];
  if (!perm) return { status: 403, reason: 'route-not-found' };

  const { userId, ...ctx } = session;
  const granted = engine.check(userId, ctx, perm.domain, perm.feature);
  return granted ? { status: 200 } : { status: 403, reason: 'forbidden' };
}

// ── 공통 셋업 ─────────────────────────────────────────────────────────────────

function buildEngine() {
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
  const engine = new UserPermissionEngine(new RoleResolver(roles, orgRoles), overrides);

  return { engine, overrides };
}

// ── 시나리오 ─────────────────────────────────────────────────────────────────

describe('권한 인증 요청 시나리오', () => {
  describe('member — 읽기만 가능', () => {
    it('프로젝트 목록 조회 → 200', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u1', orgRoleId: 'member', directAssignments: [] };
      expect(authorize(engine, session, 'GET  /projects').status).toBe(200);
    });

    it('프로젝트 생성 → 403', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u1', orgRoleId: 'member', directAssignments: [] };
      expect(authorize(engine, session, 'POST /projects').status).toBe(403);
    });

    it('승인 → 403', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u1', orgRoleId: 'member', directAssignments: [] };
      expect(authorize(engine, session, 'POST /projects/:id/approve').status).toBe(403);
    });
  });

  describe('team_lead — 읽기 + 쓰기, 승인 불가', () => {
    it('프로젝트 생성 → 200', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u2', orgRoleId: 'team_lead', directAssignments: [] };
      expect(authorize(engine, session, 'POST /projects').status).toBe(200);
    });

    it('프로젝트 수정 → 200', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u2', orgRoleId: 'team_lead', directAssignments: [] };
      expect(authorize(engine, session, 'PUT  /projects/:id').status).toBe(200);
    });

    it('프로젝트 삭제 → 403', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u2', orgRoleId: 'team_lead', directAssignments: [] };
      expect(authorize(engine, session, 'DELETE /projects/:id').status).toBe(403);
    });

    it('승인 → 403', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u2', orgRoleId: 'team_lead', directAssignments: [] };
      expect(authorize(engine, session, 'POST /projects/:id/approve').status).toBe(403);
    });
  });

  describe('div_head — 전 권한', () => {
    it('프로젝트 삭제 → 200', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u3', orgRoleId: 'div_head', directAssignments: [] };
      expect(authorize(engine, session, 'DELETE /projects/:id').status).toBe(200);
    });

    it('승인 → 200', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u3', orgRoleId: 'div_head', directAssignments: [] };
      expect(authorize(engine, session, 'POST /projects/:id/approve').status).toBe(200);
    });

    it('청구서 승인 → 200', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u3', orgRoleId: 'div_head', directAssignments: [] };
      expect(authorize(engine, session, 'POST /invoices/:id/approve').status).toBe(200);
    });
  });

  describe('user override — 개별 권한 비활성화', () => {
    it('team_lead의 쓰기 권한을 비활성화하면 PUT → 403', () => {
      const { engine, overrides } = buildEngine();
      const session = { userId: 'u4', orgRoleId: 'team_lead', directAssignments: [] };

      expect(authorize(engine, session, 'PUT  /projects/:id').status).toBe(200);

      overrides.deny('u4', 'project', 'resource:write');

      expect(authorize(engine, session, 'PUT  /projects/:id').status).toBe(403);
      // 읽기는 영향 없음
      expect(authorize(engine, session, 'GET  /projects').status).toBe(200);
    });

    it('override 해제 후 권한 복원', () => {
      const { engine, overrides } = buildEngine();
      const session = { userId: 'u5', orgRoleId: 'team_lead', directAssignments: [] };

      overrides.deny('u5', 'project', 'resource:write');
      expect(authorize(engine, session, 'PUT  /projects/:id').status).toBe(403);

      overrides.undeny('u5', 'project', 'resource:write');
      expect(authorize(engine, session, 'PUT  /projects/:id').status).toBe(200);
    });
  });

  describe('direct 배정 — org role 없이 특정 권한만 부여', () => {
    it('청구서 승인권만 직접 부여된 외부 감사자', () => {
      const { engine } = buildEngine();
      const session = {
        userId: 'u-auditor',
        directAssignments: [{ domain: 'billing', role: 'approver' }],
      };

      expect(authorize(engine, session, 'GET  /invoices').status).toBe(200); // approver → viewer 상속
      expect(authorize(engine, session, 'POST /invoices/:id/approve').status).toBe(200);
      expect(authorize(engine, session, 'GET  /projects').status).toBe(403); // project 권한 없음
    });
  });

  describe('audit — 403 거부 이유 추적', () => {
    it('not-assigned: member가 승인 요청 시 미부여 이유 반환', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u6', orgRoleId: 'member', directAssignments: [] };
      const result = engine.audit('u6', session, 'project', 'action:approve');

      expect(result.granted).toBe(false);
      expect(result.denialReason).toEqual({ kind: 'not-assigned' });
      expect(result.sources).toHaveLength(0);
    });

    it('user-override: 차단된 경우 role 출처 + override 이유 동시 반환', () => {
      const { engine, overrides } = buildEngine();
      const session = { userId: 'u7', orgRoleId: 'team_lead', directAssignments: [] };

      overrides.deny('u7', 'project', 'resource:write');

      const result = engine.audit('u7', session, 'project', 'resource:write');
      expect(result.granted).toBe(false);
      expect(result.denialReason).toEqual({ kind: 'user-override' });
      // role 단계에서는 부여됐음을 알 수 있음
      expect(result.sources[0].domainRole).toBe('author');
      expect(result.sources[0].orgRoleId).toBe('team_lead');
    });

    it('granted: 권한 있는 요청의 출처 확인', () => {
      const { engine } = buildEngine();
      const session = { userId: 'u8', orgRoleId: 'team_lead', directAssignments: [] };

      const result = engine.audit('u8', session, 'project', 'resource:write');
      expect(result.granted).toBe(true);
      expect(result.denialReason).toBeNull();
      expect(result.sources[0].source).toBe('org-role');
      expect(result.sources[0].domainRole).toBe('author');
    });
  });

  describe('동시 다중 유저 — 유저 간 독립성', () => {
    it('같은 route에 대해 유저마다 다른 판정', () => {
      const { engine, overrides } = buildEngine();

      const member = { userId: 'u-member', orgRoleId: 'member', directAssignments: [] };
      const teamLead = { userId: 'u-teamlead', orgRoleId: 'team_lead', directAssignments: [] };
      const divHead = { userId: 'u-divhead', orgRoleId: 'div_head', directAssignments: [] };
      const restricted = { userId: 'u-restricted', orgRoleId: 'team_lead', directAssignments: [] };

      overrides.deny('u-restricted', 'project', 'resource:write');

      const route = 'PUT  /projects/:id';

      expect(authorize(engine, member, route).status).toBe(403);
      expect(authorize(engine, teamLead, route).status).toBe(200);
      expect(authorize(engine, divHead, route).status).toBe(200);
      expect(authorize(engine, restricted, route).status).toBe(403); // override로 차단
    });
  });
});
