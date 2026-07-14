// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

import { describe, it, expect, beforeEach } from 'vitest';
import { RoleRegistry } from './role-registry.js';

// ── 픽스처 ───────────────────────────────────────────────────────────────────

function buildProjectRoles(): RoleRegistry {
  const r = new RoleRegistry();
  r.register({
    id: 'viewer',
    domain: 'project',
    parents: [],
    ownFeatures: ['page:dashboard', 'resource:read'],
  });
  r.register({
    id: 'author',
    domain: 'project',
    parents: ['viewer'],
    ownFeatures: ['resource:write', 'api:create'],
  });
  r.register({
    id: 'manager',
    domain: 'project',
    parents: ['author'],
    ownFeatures: ['action:approve', 'resource:delete'],
  });
  r.register({
    id: 'admin',
    domain: 'project',
    parents: ['manager'],
    ownFeatures: ['action:config'],
  });
  return r;
}

// ── RoleRegistry ─────────────────────────────────────────────────────────────

describe('RoleRegistry', () => {
  describe('resolvedFeatures — 상속 체인', () => {
    it('루트 role은 ownFeatures만 가진다', () => {
      const r = buildProjectRoles();
      expect(r.resolvedFeatures('project', 'viewer')).toEqual(
        new Set(['page:dashboard', 'resource:read']),
      );
    });

    it('하위 role은 부모 features를 포함한다', () => {
      const r = buildProjectRoles();
      const authorFeats = r.resolvedFeatures('project', 'author');
      expect(authorFeats.has('page:dashboard')).toBe(true); // viewer 상속
      expect(authorFeats.has('resource:read')).toBe(true); // viewer 상속
      expect(authorFeats.has('resource:write')).toBe(true); // own
      expect(authorFeats.has('api:create')).toBe(true); // own
    });

    it('3단계 상속 — manager는 viewer+author+own을 모두 가진다', () => {
      const r = buildProjectRoles();
      const managerFeats = r.resolvedFeatures('project', 'manager');
      // viewer
      expect(managerFeats.has('page:dashboard')).toBe(true);
      expect(managerFeats.has('resource:read')).toBe(true);
      // author
      expect(managerFeats.has('resource:write')).toBe(true);
      expect(managerFeats.has('api:create')).toBe(true);
      // own
      expect(managerFeats.has('action:approve')).toBe(true);
      expect(managerFeats.has('resource:delete')).toBe(true);
    });

    it('4단계 상속 — admin은 전체 체인을 포함한다', () => {
      const r = buildProjectRoles();
      const adminFeats = r.resolvedFeatures('project', 'admin');
      expect(adminFeats.size).toBe(7); // viewer(2) + author(2) + manager(2) + admin(1)
    });

    it('결과가 캐시된다 (동일 참조)', () => {
      const r = buildProjectRoles();
      const first = r.resolvedFeatures('project', 'author');
      const second = r.resolvedFeatures('project', 'author');
      expect(first).toBe(second);
    });
  });

  describe('분기 상속', () => {
    it('두 부모의 features를 모두 합산한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'reader',
        domain: 'doc',
        parents: [],
        ownFeatures: ['page:view', 'resource:read'],
      });
      r.register({ id: 'commenter', domain: 'doc', parents: [], ownFeatures: ['action:comment'] });
      r.register({
        id: 'editor',
        domain: 'doc',
        parents: ['reader', 'commenter'],
        ownFeatures: ['resource:write'],
      });

      const editorFeats = r.resolvedFeatures('doc', 'editor');
      expect(editorFeats.has('page:view')).toBe(true);
      expect(editorFeats.has('resource:read')).toBe(true);
      expect(editorFeats.has('action:comment')).toBe(true);
      expect(editorFeats.has('resource:write')).toBe(true);
    });
  });

  describe('buildDomainPermissionSet', () => {
    it('domain의 전체 feature × role 행렬을 빌드한다', () => {
      const r = buildProjectRoles();
      const ps = r.buildDomainPermissionSet('project');

      // viewer는 자기 own features만
      expect(ps.has('page:dashboard', 'viewer')).toBe(true);
      expect(ps.has('resource:write', 'viewer')).toBe(false);

      // author는 viewer 상속 포함
      expect(ps.has('page:dashboard', 'author')).toBe(true);
      expect(ps.has('resource:write', 'author')).toBe(true);

      // manager는 author 상속 포함
      expect(ps.has('api:create', 'manager')).toBe(true);
      expect(ps.has('action:approve', 'manager')).toBe(true);

      // viewer는 manager only feature 없음
      expect(ps.has('action:approve', 'viewer')).toBe(false);
    });

    it('결과가 캐시된다 (동일 참조)', () => {
      const r = buildProjectRoles();
      expect(r.buildDomainPermissionSet('project')).toBe(r.buildDomainPermissionSet('project'));
    });

    it('새 role 등록 시 캐시가 무효화된다', () => {
      const r = buildProjectRoles();
      const before = r.buildDomainPermissionSet('project');
      r.register({
        id: 'superadmin',
        domain: 'project',
        parents: ['admin'],
        ownFeatures: ['action:nuke'],
      });
      const after = r.buildDomainPermissionSet('project');
      expect(before).not.toBe(after);
    });
  });

  describe('roleMask', () => {
    it('role의 1D feature 마스크를 반환한다', () => {
      const r = buildProjectRoles();
      const featureIds = r.domainFeatureIds('project');
      const viewerMask = r.roleMask('project', 'viewer');
      const authorMask = r.roleMask('project', 'author');

      // author mask는 viewer mask의 superset (author ⊃ viewer)
      for (let i = 0; i < featureIds.length; i++) {
        const bit = 1 << (i % 8);
        const byte = Math.floor(i / 8);
        const viewerHas = (viewerMask[byte] & bit) !== 0;
        const authorHas = (authorMask[byte] & bit) !== 0;
        if (viewerHas) expect(authorHas).toBe(true);
      }
    });
  });

  describe('validate', () => {
    it('정상 계보는 오류 없음', () => {
      expect(buildProjectRoles().validate()).toEqual([]);
    });

    it('존재하지 않는 부모 참조를 감지한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'author',
        domain: 'project',
        parents: ['viewer'],
        ownFeatures: ['resource:write'],
      });
      const errors = r.validate();
      expect(errors.length).toBe(1);
      expect(errors[0].kind).toBe('unknown-parent');
    });

    it('순환 상속을 감지한다', () => {
      const r = new RoleRegistry();
      r.register({ id: 'a', domain: 'x', parents: ['b'], ownFeatures: [] });
      r.register({ id: 'b', domain: 'x', parents: ['a'], ownFeatures: [] });
      const errors = r.validate();
      expect(errors.some((e) => e.kind === 'cycle')).toBe(true);
    });
  });

  describe('deny 레이어 — denyFeatures', () => {
    it('상속된 feature를 개별 제거한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'viewer',
        domain: 'project',
        parents: [],
        ownFeatures: ['page:dashboard', 'resource:read'],
      });
      r.register({
        id: 'author',
        domain: 'project',
        parents: ['viewer'],
        ownFeatures: ['resource:write', 'api:create'],
      });
      r.register({
        id: 'api-author',
        domain: 'project',
        parents: ['author'],
        ownFeatures: [],
        denyFeatures: ['page:dashboard'],
      });

      const feats = r.resolvedFeatures('project', 'api-author');
      expect(feats.has('page:dashboard')).toBe(false); // deny됨
      expect(feats.has('resource:read')).toBe(true); // 유지
      expect(feats.has('resource:write')).toBe(true); // 유지
      expect(feats.has('api:create')).toBe(true); // 유지
    });

    it('ownFeatures도 deny 가능하다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'special',
        domain: 'd',
        parents: [],
        ownFeatures: ['a', 'b'],
        denyFeatures: ['a'],
      });
      const feats = r.resolvedFeatures('d', 'special');
      expect(feats.has('a')).toBe(false);
      expect(feats.has('b')).toBe(true);
    });
  });

  describe('deny 레이어 — denyRoles', () => {
    it('특정 role의 feature를 통째로 제거한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'viewer',
        domain: 'project',
        parents: [],
        ownFeatures: ['page:dashboard', 'resource:read'],
      });
      r.register({
        id: 'auditor',
        domain: 'project',
        parents: [],
        ownFeatures: ['audit:log', 'audit:export'],
      });
      r.register({
        id: 'manager',
        domain: 'project',
        parents: ['viewer', 'auditor'],
        ownFeatures: ['action:approve'],
      });
      r.register({
        id: 'ops-manager',
        domain: 'project',
        parents: ['manager'],
        ownFeatures: [],
        denyRoles: ['auditor'],
      });

      const feats = r.resolvedFeatures('project', 'ops-manager');
      // auditor 계열 전부 제거
      expect(feats.has('audit:log')).toBe(false);
      expect(feats.has('audit:export')).toBe(false);
      // viewer + manager 유지
      expect(feats.has('page:dashboard')).toBe(true);
      expect(feats.has('resource:read')).toBe(true);
      expect(feats.has('action:approve')).toBe(true);
    });

    it('denyRoles와 denyFeatures를 함께 사용한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'viewer',
        domain: 'd',
        parents: [],
        ownFeatures: ['page:dashboard', 'resource:read'],
      });
      r.register({ id: 'writer', domain: 'd', parents: [], ownFeatures: ['resource:write'] });
      r.register({
        id: 'restricted',
        domain: 'd',
        parents: ['viewer', 'writer'],
        ownFeatures: ['special:access'],
        denyRoles: ['writer'],
        denyFeatures: ['page:dashboard'],
      });

      const feats = r.resolvedFeatures('d', 'restricted');
      expect(feats.has('resource:write')).toBe(false); // denyRoles
      expect(feats.has('page:dashboard')).toBe(false); // denyFeatures
      expect(feats.has('resource:read')).toBe(true); // 유지
      expect(feats.has('special:access')).toBe(true); // own 유지
    });

    it('denyRoles 대상 role에 feature 추가 시 자동 deny 반영', () => {
      const r = new RoleRegistry();
      r.register({ id: 'base', domain: 'd', parents: [], ownFeatures: ['a', 'b'] });
      r.register({ id: 'extra', domain: 'd', parents: ['base'], ownFeatures: ['c'] });
      r.register({
        id: 'filtered',
        domain: 'd',
        parents: ['extra'],
        ownFeatures: [],
        denyRoles: ['base'],
      });

      const feats = r.resolvedFeatures('d', 'filtered');
      // base의 resolved = {a, b} → 전부 deny
      expect(feats.has('a')).toBe(false);
      expect(feats.has('b')).toBe(false);
      // extra의 own인 c는 유지
      expect(feats.has('c')).toBe(true);
    });
  });

  describe('deny 레이어 — buildDomainPermissionSet 반영', () => {
    it('deny가 mask에 반영된다', () => {
      const r = new RoleRegistry();
      r.register({ id: 'viewer', domain: 'd', parents: [], ownFeatures: ['a', 'b', 'c'] });
      r.register({
        id: 'limited',
        domain: 'd',
        parents: ['viewer'],
        ownFeatures: [],
        denyFeatures: ['b'],
      });

      const ps = r.buildDomainPermissionSet('d');
      expect(ps.has('a', 'limited')).toBe(true);
      expect(ps.has('b', 'limited')).toBe(false);
      expect(ps.has('c', 'limited')).toBe(true);
      // viewer는 영향 없음
      expect(ps.has('b', 'viewer')).toBe(true);
    });
  });

  describe('deny 레이어 — validate', () => {
    it('존재하지 않는 denyRole을 감지한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'a',
        domain: 'd',
        parents: [],
        ownFeatures: [],
        denyRoles: ['ghost'],
      });
      const errors = r.validate();
      expect(errors.length).toBe(1);
      expect(errors[0].kind).toBe('unknown-deny-role');
    });

    it('자기 자신을 deny하면 감지한다', () => {
      const r = new RoleRegistry();
      r.register({
        id: 'a',
        domain: 'd',
        parents: [],
        ownFeatures: ['x'],
        denyRoles: ['a'],
      });
      const errors = r.validate();
      expect(errors.some((e) => e.kind === 'self-deny-role')).toBe(true);
    });

    it('정상 deny 정의는 오류 없음', () => {
      const r = new RoleRegistry();
      r.register({ id: 'base', domain: 'd', parents: [], ownFeatures: ['a'] });
      r.register({
        id: 'filtered',
        domain: 'd',
        parents: ['base'],
        ownFeatures: [],
        denyRoles: ['base'],
        denyFeatures: ['a'],
      });
      expect(r.validate()).toEqual([]);
    });
  });

  describe('에러 케이스', () => {
    it('중복 role 등록 시 throw', () => {
      const r = buildProjectRoles();
      expect(() =>
        r.register({ id: 'viewer', domain: 'project', parents: [], ownFeatures: [] }),
      ).toThrow('Duplicate');
    });

    it('알 수 없는 domain 조회 시 throw', () => {
      const r = buildProjectRoles();
      expect(() => r.resolvedFeatures('unknown', 'viewer')).toThrow();
    });

    it('알 수 없는 role 조회 시 throw', () => {
      const r = buildProjectRoles();
      expect(() => r.resolvedFeatures('project', 'ghost')).toThrow();
    });
  });
});
