// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

import { describe, it, expect } from 'vitest';
import { PermissionSet, type DimDef } from './permission-set.js';

const FEATURES: DimDef = {
  name: 'features',
  ids: [
    'product_list',
    'order_list',
    'payment_history',
    'payment_cancel',
    'user_mgmt',
    'config_change',
  ],
};

const ROLES: DimDef = {
  name: 'roles',
  ids: ['admin', 'developer', 'operator', 'customer', 'viewer', 'readonly'],
};

function fresh(): PermissionSet {
  return new PermissionSet({ features: FEATURES, roles: ROLES });
}

describe('PermissionSet', () => {
  it('시작 시 전체 deny', () => {
    const ps = fresh();
    expect(ps.size).toBe(36); // 6 × 6
    expect(ps.grantCount).toBe(0);
    expect(ps.has('product_list', 'admin')).toBe(false);
  });

  it('grant → has → revoke', () => {
    const ps = fresh();
    ps.grant('payment_history', 'admin');
    expect(ps.has('payment_history', 'admin')).toBe(true);
    expect(ps.has('payment_history', 'viewer')).toBe(false);
    expect(ps.grantCount).toBe(1);

    ps.revoke('payment_history', 'admin');
    expect(ps.has('payment_history', 'admin')).toBe(false);
    expect(ps.grantCount).toBe(0);
  });

  it('grantRoles — 배치 부여', () => {
    const ps = fresh();
    ps.grantRoles('payment_history', ['admin', 'operator', 'viewer']);
    expect(ps.rolesFor('payment_history')).toEqual(['admin', 'operator', 'viewer']);
    expect(ps.grantCount).toBe(3);
  });

  it('grantAllRoles / revokeAllRoles', () => {
    const ps = fresh();
    ps.grantAllRoles('product_list');
    expect(ps.rolesFor('product_list')).toEqual([...ROLES.ids]);
    expect(ps.grantCount).toBe(6);

    ps.revokeAllRoles('product_list');
    expect(ps.rolesFor('product_list')).toEqual([]);
    expect(ps.grantCount).toBe(0);
  });

  it('grantAllFeatures / featuresFor', () => {
    const ps = fresh();
    ps.grantAllFeatures('admin');
    expect(ps.featuresFor('admin')).toEqual([...FEATURES.ids]);
    expect(ps.grantCount).toBe(6);
  });

  it('grantAll / revokeAll', () => {
    const ps = fresh();
    ps.grantAll();
    expect(ps.grantCount).toBe(36);
    ps.revokeAll();
    expect(ps.grantCount).toBe(0);
  });

  it('hasAnyRole', () => {
    const ps = fresh();
    ps.grant('payment_history', 'operator');
    expect(ps.hasAnyRole('payment_history', ['admin', 'operator'])).toBe(true);
    expect(ps.hasAnyRole('payment_history', ['customer', 'viewer'])).toBe(false);
  });

  it('toMatrix / fromMatrix 라운드트립', () => {
    const ps = fresh();
    ps.grant('product_list', 'admin');
    ps.grant('payment_history', 'operator');

    const matrix = ps.toMatrix();
    expect(matrix[0][0]).toBe(true); // product_list × admin
    expect(matrix[0][1]).toBe(false); // product_list × developer
    expect(matrix[2][2]).toBe(true); // payment_history × operator

    const ps2 = PermissionSet.fromMatrix(FEATURES, ROLES, matrix);
    expect(ps2.has('product_list', 'admin')).toBe(true);
    expect(ps2.has('payment_history', 'operator')).toBe(true);
    expect(ps2.grantCount).toBe(2);
  });

  it('intersect / union', () => {
    const a = fresh();
    a.grant('product_list', 'admin');
    a.grant('order_list', 'admin');

    const b = fresh();
    b.grant('product_list', 'admin');
    b.grant('payment_history', 'admin');

    const inter = a.intersect(b);
    expect(inter.grantCount).toBe(1);
    expect(inter.has('product_list', 'admin')).toBe(true);

    const uni = a.union(b);
    expect(uni.grantCount).toBe(3);
  });

  it('toSnapshot / fromSnapshot 라운드트립', () => {
    const ps = fresh();
    ps.grant('config_change', 'admin');
    ps.grant('user_mgmt', 'admin');

    const snap = ps.toSnapshot();
    expect(snap.features).toEqual([...FEATURES.ids]);
    expect(typeof snap.mask).toBe('string');

    const restored = PermissionSet.fromSnapshot(snap);
    expect(restored.has('config_change', 'admin')).toBe(true);
    expect(restored.has('user_mgmt', 'admin')).toBe(true);
    expect(restored.grantCount).toBe(2);
  });

  it('toBytes / fromBytes 라운드트립', () => {
    const ps = fresh();
    ps.grantAllFeatures('admin');
    const bytes = ps.toBytes();
    const restored = PermissionSet.fromBytes(FEATURES, ROLES, bytes);
    expect(restored.featuresFor('admin')).toEqual([...FEATURES.ids]);
  });

  it('clone은 독립 복사', () => {
    const ps = fresh();
    ps.grant('order_list', 'developer');
    const cloned = ps.clone();
    cloned.revoke('order_list', 'developer');
    expect(ps.has('order_list', 'developer')).toBe(true);
    expect(cloned.has('order_list', 'developer')).toBe(false);
  });

  it('알 수 없는 feature/role에 에러', () => {
    const ps = fresh();
    expect(() => ps.grant('unknown_feature', 'admin')).toThrow('Unknown feature');
    expect(() => ps.grant('product_list', 'unknown_role')).toThrow('Unknown role');
  });

  it('중복 ID 검증', () => {
    expect(
      () =>
        new PermissionSet({
          features: { name: 'f', ids: ['a', 'a'] },
          roles: ROLES,
        }),
    ).toThrow('Duplicate');
  });

  it('queryRange — 와일드카드 범위 쿼리', () => {
    const ps = fresh();
    // feature 0 (product_list)의 모든 role 주소
    const addrs = ps.queryRange(['1', null]);
    expect(addrs.length).toBe(6); // 6 roles
  });

  it('queryGranted — 부여된 주소만 반환', () => {
    const ps = fresh();
    ps.grant('product_list', 'admin');
    ps.grant('product_list', 'viewer');

    const granted = ps.queryGranted(['1', null]);
    expect(granted.length).toBe(2);
  });
});
