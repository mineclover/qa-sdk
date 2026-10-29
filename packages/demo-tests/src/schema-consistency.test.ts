// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * 스키마 일관성 테스트.
 *
 * demo-snapshot의 헬퍼 함수, Feature 정의, SVC 상수가
 * 서로 일관되고 정확한지 검증한다.
 */
import { describe, it, expect } from 'vitest';
import {
  DEMO_SVC,
  DEMO_FEATURES_V1,
  DEMO_FEATURES_V2,
  DEMO_ROLE_POS_V1,
  DEMO_ROLE_POS_V2,
  DEMO_ROLES_V1,
  DEMO_ROLES_V2,
  DEMO_PERM_SVC_VALUES,
  DEMO_EVT_SVC_VALUES,
  demoEncodeSvc,
  demoDecodeSvc,
  demoRoleStride,
  demoEvtStride,
  demoCalcPermAddr,
  demoCalcEvtAddr,
  DEMO_FEATURE_KO,
} from 'demo-snapshot';

describe('SVC 주소 상수 일관성', () => {
  it('DEMO_SVC 값이 demoEncodeSvc 결과와 일치', () => {
    expect(DEMO_SVC.DEV_ASIA_SHOPPING_WEB_SHOP).toBe(demoEncodeSvc([1, 1, 1, 1]));
    expect(DEMO_SVC.PROD_ASIA_PAYMENT_SHOP).toBe(demoEncodeSvc([3, 1, 4, 1]));
    expect(DEMO_SVC.PROD_ASIA_GATEWAY_CMS).toBe(demoEncodeSvc([3, 1, 5, 2]));
  });

  it('DEMO_SVC encode → decode 라운드트립', () => {
    const coords = demoDecodeSvc(DEMO_SVC.PROD_ASIA_PAYMENT_SHOP);
    expect(coords).toEqual([3, 1, 4, 1]); // prod, asia, payment, shop
  });

  it('PERM_SVC_VALUES — 모두 유효한 서비스 주소', () => {
    for (const v of DEMO_PERM_SVC_VALUES) {
      const coords = demoDecodeSvc(v);
      expect(coords.every((c) => c >= 1)).toBe(true);
    }
  });

  it('EVT_SVC_VALUES — 모두 유효한 서비스 주소', () => {
    for (const v of DEMO_EVT_SVC_VALUES) {
      const coords = demoDecodeSvc(v);
      expect(coords.every((c) => c >= 1)).toBe(true);
    }
  });
});

describe('ROLE_POS 일관성', () => {
  it('ROLE_POS_V1 — DEMO_ROLES_V1과 매핑 일치', () => {
    for (let i = 0; i < DEMO_ROLES_V1.length; i++) {
      expect(DEMO_ROLE_POS_V1[DEMO_ROLES_V1[i]]).toBe(i + 1);
    }
  });

  it('ROLE_POS_V2 — DEMO_ROLES_V2와 매핑 일치', () => {
    for (let i = 0; i < DEMO_ROLES_V2.length; i++) {
      expect(DEMO_ROLE_POS_V2[DEMO_ROLES_V2[i]]).toBe(i + 1);
    }
  });
});

describe('Feature 정의 일관성', () => {
  it('v1 feature의 permSvcPos가 PERM_SVC 범위 안에 존재', () => {
    for (const f of DEMO_FEATURES_V1) {
      expect(DEMO_PERM_SVC_VALUES[f.permSvcPos - 1], `${f.id}: invalid permSvcPos`).toBeDefined();
    }
  });

  it('v2 feature의 permSvcPos가 PERM_SVC 범위 안에 존재', () => {
    for (const f of DEMO_FEATURES_V2) {
      expect(DEMO_PERM_SVC_VALUES[f.permSvcPos - 1], `${f.id}: invalid permSvcPos`).toBeDefined();
    }
  });

  it('v1 feature의 grantedRoles가 모두 v1 역할에 존재', () => {
    const v1Set = new Set<string>(DEMO_ROLES_V1);
    for (const f of DEMO_FEATURES_V1) {
      for (const r of f.grantedRoles) {
        expect(v1Set.has(r), `${f.id}: role "${r}" not in v1 roles`).toBe(true);
      }
    }
  });

  it('v2 feature의 grantedRoles가 모두 v2 역할에 존재', () => {
    const v2Set = new Set<string>(DEMO_ROLES_V2);
    for (const f of DEMO_FEATURES_V2) {
      for (const r of f.grantedRoles) {
        expect(v2Set.has(r), `${f.id}: role "${r}" not in v2 roles`).toBe(true);
      }
    }
  });

  it('모든 feature에 한국어 라벨 존재', () => {
    const allFeatures = new Set([
      ...DEMO_FEATURES_V1.map((f) => f.id),
      ...DEMO_FEATURES_V2.map((f) => f.id),
    ]);
    for (const id of allFeatures) {
      expect(DEMO_FEATURE_KO[id], `missing KO for "${id}"`).toBeTruthy();
    }
  });

  it('v1 feature permSvcPos — stride 기반 주소 계산 검증', () => {
    const stride = demoRoleStride('v1');
    for (const f of DEMO_FEATURES_V1) {
      const adminAddr = demoCalcPermAddr(f.permSvcPos, 1, 'v1');
      expect(adminAddr).toBe((f.permSvcPos - 1) * stride);
    }
  });

  it('v2 feature permSvcPos — stride 기반 주소 계산 검증', () => {
    const stride = demoRoleStride('v2');
    for (const f of DEMO_FEATURES_V2) {
      const adminAddr = demoCalcPermAddr(f.permSvcPos, 1, 'v2');
      expect(adminAddr).toBe((f.permSvcPos - 1) * stride);
    }
  });
});
