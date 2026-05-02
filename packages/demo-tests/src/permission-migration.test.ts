// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * 권한 마이그레이션 통합 테스트.
 *
 * demo-snapshot의 Feature/Role 정의를 사용하여
 * permission-engine의 v1→v2 마이그레이션을 검증한다.
 */
import { describe, it, expect } from "vitest";
import { PermissionSet, migratePermissions, ScopedEngine, type DimDef } from "permission-engine";
import {
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_FEATURES_V1, DEMO_FEATURES_V2,
  DEMO_ROLE_POS_V2,
} from "demo-snapshot";

const FEATURES_V1: DimDef = { name: "features", ids: DEMO_FEATURES_V1.map(f => f.id) };
const FEATURES_V2: DimDef = { name: "features", ids: DEMO_FEATURES_V2.map(f => f.id) };
const ROLES_V1: DimDef = { name: "roles", ids: [...DEMO_ROLES_V1] };
const ROLES_V2: DimDef = { name: "roles", ids: [...DEMO_ROLES_V2] };

function createV1WithDefaults(): PermissionSet {
  const ps = new PermissionSet({ features: FEATURES_V1, roles: ROLES_V1 });
  for (const f of DEMO_FEATURES_V1) {
    ps.grantRoles(f.id, f.grantedRoles);
  }
  return ps;
}

describe("permission-engine × demo-snapshot 통합", () => {
  it("v1 기본 grant — demo Feature 정의와 일치", () => {
    const ps = createV1WithDefaults();

    for (const f of DEMO_FEATURES_V1) {
      expect(ps.rolesFor(f.id).toSorted()).toEqual([...f.grantedRoles].toSorted());
    }
  });

  it("자동 마이그레이션 — 공통 feature/role 보존", () => {
    const v1 = createV1WithDefaults();
    const v2 = migratePermissions(v1, FEATURES_V2, ROLES_V2);

    // product_list의 v1 grant (admin, developer, operator, viewer, readonly) 보존
    expect(v2.has("product_list", "admin")).toBe(true);
    expect(v2.has("product_list", "viewer")).toBe(true);
    expect(v2.has("product_list", "readonly")).toBe(true);

    // 신규 역할 customer — 자동 마이그레이션은 deny
    expect(v2.has("product_list", "customer")).toBe(false);

    // 삭제된 feature (payment_cancel) — v2에 없음
    expect(v2.features).not.toContain("payment_cancel");

    // 신규 feature — 자동 마이그레이션은 deny
    expect(v2.has("payment_cancel_req", "admin")).toBe(false);
  });

  it("커스텀 매퍼 마이그레이션 — payment_cancel 분리", () => {
    const v1 = createV1WithDefaults();

    const v2 = migratePermissions(v1, FEATURES_V2, ROLES_V2, (fi, ri) => {
      const featId = FEATURES_V1.ids[fi - 1];
      const roleId = ROLES_V1.ids[ri - 1];

      if (featId === "payment_cancel") {
        const newRi = ROLES_V2.ids.indexOf(roleId);
        if (newRi === -1) return null;
        return [FEATURES_V2.ids.indexOf("payment_cancel_req") + 1, newRi + 1];
      }

      const newFi = FEATURES_V2.ids.indexOf(featId);
      const newRi = ROLES_V2.ids.indexOf(roleId);
      if (newFi === -1 || newRi === -1) return null;
      return [newFi + 1, newRi + 1];
    });

    // payment_cancel의 v1 grant(admin,developer,operator) → payment_cancel_req로 이관
    expect(v2.has("payment_cancel_req", "admin")).toBe(true);
    expect(v2.has("payment_cancel_req", "developer")).toBe(true);
    expect(v2.has("payment_cancel_req", "operator")).toBe(true);

    // payment_cancel_approve는 매퍼에서 별도 처리 안 함 → deny
    expect(v2.has("payment_cancel_approve", "admin")).toBe(false);
  });

  it("ScopedEngine — 다중 환경 권한 관리", () => {
    const engine = new ScopedEngine(FEATURES_V2, ROLES_V2);

    // prod: v2 기본 grant
    const prod = engine.scope("prod:asia");
    for (const f of DEMO_FEATURES_V2) {
      prod.grantRoles(f.id, [...f.grantedRoles]);
    }

    // dev: 전체 부여
    engine.scope("dev:asia").grantAll();

    // union: dev가 전체 → union도 전체
    const uni = engine.unionScopes(["prod:asia", "dev:asia"]);
    expect(uni.grantCount).toBe(uni.size);

    // intersect: prod 기준
    const inter = engine.intersectScopes(["prod:asia", "dev:asia"]);
    expect(inter.grantCount).toBe(prod.grantCount);

    // 스냅샷 라운드트립
    const snap = engine.toSnapshot();
    const restored = ScopedEngine.fromSnapshot(snap);
    expect(restored.scopeKeys().toSorted()).toEqual(["dev:asia", "prod:asia"]);
    expect(restored.scope("prod:asia").grantCount).toBe(prod.grantCount);
  });

  it("v2 PermissionSet 직렬화 크기 효율성", () => {
    const ps = new PermissionSet({ features: FEATURES_V2, roles: ROLES_V2 });
    for (const f of DEMO_FEATURES_V2) ps.grantRoles(f.id, [...f.grantedRoles]);

    const bytes = ps.toBytes();
    // 7 features × 6 roles = 42 bits → 6 bytes
    expect(bytes.length).toBe(Math.ceil(42 / 8));

    // 스냅샷 라운드트립
    const snap = ps.toSnapshot();
    const restored = PermissionSet.fromSnapshot(snap);
    expect(restored.grantCount).toBe(ps.grantCount);
  });
});
