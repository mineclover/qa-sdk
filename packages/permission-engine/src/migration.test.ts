import { describe, it, expect } from "vitest";
import { PermissionSet, migratePermissions, type DimDef } from "./index.js";

const FEATURES_V1: DimDef = {
  name: "features",
  ids: ["product_list", "order_list", "payment_history", "payment_cancel", "user_mgmt", "config_change"],
};

const ROLES_V1: DimDef = {
  name: "roles",
  ids: ["admin", "developer", "operator", "viewer", "readonly"],
};

// v2: customer 역할 추가, payment_cancel → payment_cancel_req + payment_cancel_approve 분리
const FEATURES_V2: DimDef = {
  name: "features",
  ids: ["product_list", "order_list", "payment_history", "payment_cancel_req", "payment_cancel_approve", "user_mgmt", "config_change"],
};

const ROLES_V2: DimDef = {
  name: "roles",
  ids: ["admin", "developer", "operator", "viewer", "readonly", "customer"],
};

describe("migratePermissions", () => {
  it("ID 매칭 자동 변환 — 공통 feature/role의 grant 보존", () => {
    const v1 = new PermissionSet({ features: FEATURES_V1, roles: ROLES_V1 });
    v1.grant("product_list", "admin");
    v1.grant("product_list", "viewer");
    v1.grant("payment_history", "operator");
    v1.grant("user_mgmt", "admin");

    const v2 = migratePermissions(v1, FEATURES_V2, ROLES_V2);

    // 보존된 grant
    expect(v2.has("product_list", "admin")).toBe(true);
    expect(v2.has("product_list", "viewer")).toBe(true);
    expect(v2.has("payment_history", "operator")).toBe(true);
    expect(v2.has("user_mgmt", "admin")).toBe(true);

    // 새 역할 customer는 grant 없음
    expect(v2.has("product_list", "customer")).toBe(false);

    // 삭제된 feature (payment_cancel)의 grant는 사라짐
    // 새 feature (payment_cancel_req, payment_cancel_approve)는 grant 없음
    expect(v2.has("payment_cancel_req", "admin")).toBe(false);
    expect(v2.has("payment_cancel_approve", "admin")).toBe(false);
  });

  it("명시적 매퍼 — payment_cancel → payment_cancel_req로 이관", () => {
    const v1 = new PermissionSet({ features: FEATURES_V1, roles: ROLES_V1 });
    v1.grant("payment_cancel", "admin");
    v1.grant("payment_cancel", "operator");

    const v2 = migratePermissions(v1, FEATURES_V2, ROLES_V2, (fi, ri) => {
      const featId = FEATURES_V1.ids[fi - 1];
      const roleId = ROLES_V1.ids[ri - 1];

      // payment_cancel → payment_cancel_req + payment_cancel_approve 모두에 이관
      if (featId === "payment_cancel") {
        // 첫 번째 호출에서 req에 매핑
        const newRi = ROLES_V2.ids.indexOf(roleId);
        if (newRi === -1) return null;
        return [FEATURES_V2.ids.indexOf("payment_cancel_req") + 1, newRi + 1];
      }

      // 나머지: ID 매칭
      const newFi = FEATURES_V2.ids.indexOf(featId);
      const newRi = ROLES_V2.ids.indexOf(roleId);
      if (newFi === -1 || newRi === -1) return null;
      return [newFi + 1, newRi + 1];
    });

    expect(v2.has("payment_cancel_req", "admin")).toBe(true);
    expect(v2.has("payment_cancel_req", "operator")).toBe(true);
  });

  it("역할만 추가된 단순 마이그레이션", () => {
    const rolesOld: DimDef = { name: "roles", ids: ["admin", "user"] };
    const rolesNew: DimDef = { name: "roles", ids: ["admin", "user", "guest"] };
    const features: DimDef = { name: "features", ids: ["read", "write"] };

    const old = new PermissionSet({ features, roles: rolesOld });
    old.grant("read", "admin");
    old.grant("write", "admin");
    old.grant("read", "user");

    const migrated = migratePermissions(old, features, rolesNew);
    expect(migrated.has("read", "admin")).toBe(true);
    expect(migrated.has("write", "admin")).toBe(true);
    expect(migrated.has("read", "user")).toBe(true);
    expect(migrated.has("read", "guest")).toBe(false);
    expect(migrated.grantCount).toBe(3);
  });
});
