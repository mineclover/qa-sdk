import { describe, it, expect } from "vitest";
import { ScopedEngine, type DimDef } from "./index.js";

const FEATURES: DimDef = {
  name: "features",
  ids: ["payment_history", "payment_cancel", "user_mgmt"],
};

const ROLES: DimDef = {
  name: "roles",
  ids: ["admin", "operator", "customer"],
};

describe("ScopedEngine", () => {
  it("스코프별 독립 권한 관리", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);

    engine.scope("prod:asia").grant("payment_history", "admin");
    engine.scope("dev:usa").grant("user_mgmt", "admin");

    expect(engine.scope("prod:asia").has("payment_history", "admin")).toBe(true);
    expect(engine.scope("prod:asia").has("user_mgmt", "admin")).toBe(false);
    expect(engine.scope("dev:usa").has("user_mgmt", "admin")).toBe(true);
    expect(engine.scope("dev:usa").has("payment_history", "admin")).toBe(false);
  });

  it("새 스코프는 전체 deny", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);
    const ps = engine.scope("staging:eu");
    expect(ps.grantCount).toBe(0);
    expect(engine.hasScope("staging:eu")).toBe(true);
  });

  it("scopeKeys / deleteScope", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);
    engine.scope("prod:asia");
    engine.scope("dev:usa");
    expect(engine.scopeKeys()).toEqual(["prod:asia", "dev:usa"]);

    engine.deleteScope("dev:usa");
    expect(engine.hasScope("dev:usa")).toBe(false);
    expect(engine.scopeKeys()).toEqual(["prod:asia"]);
  });

  it("unionScopes — 어느 환경에서든 접근 가능한지", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);
    engine.scope("prod:asia").grant("payment_history", "admin");
    engine.scope("dev:usa").grant("user_mgmt", "admin");

    const union = engine.unionScopes(["prod:asia", "dev:usa"]);
    expect(union.has("payment_history", "admin")).toBe(true);
    expect(union.has("user_mgmt", "admin")).toBe(true);
    expect(union.has("payment_cancel", "admin")).toBe(false);
  });

  it("intersectScopes — 모든 환경에서 접근 가능한지", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);
    engine.scope("prod:asia").grant("payment_history", "admin");
    engine.scope("prod:asia").grant("user_mgmt", "admin");
    engine.scope("dev:usa").grant("payment_history", "admin");

    const inter = engine.intersectScopes(["prod:asia", "dev:usa"]);
    expect(inter.has("payment_history", "admin")).toBe(true);
    expect(inter.has("user_mgmt", "admin")).toBe(false); // dev:usa에 없음
  });

  it("intersectScopes — 존재하지 않는 스코프 포함 시 전체 deny", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);
    engine.scope("prod:asia").grantAll();

    const inter = engine.intersectScopes(["prod:asia", "nonexistent"]);
    expect(inter.grantCount).toBe(0);
  });

  it("toSnapshot / fromSnapshot 라운드트립", () => {
    const engine = new ScopedEngine(FEATURES, ROLES);
    engine.scope("prod:asia").grant("payment_history", "admin");
    engine.scope("dev:usa").grant("user_mgmt", "operator");

    const snap = engine.toSnapshot();
    expect(Object.keys(snap.scopes)).toEqual(["prod:asia", "dev:usa"]);

    const restored = ScopedEngine.fromSnapshot(snap);
    expect(restored.scope("prod:asia").has("payment_history", "admin")).toBe(true);
    expect(restored.scope("dev:usa").has("user_mgmt", "operator")).toBe(true);
    expect(restored.scope("dev:usa").has("payment_history", "admin")).toBe(false);
  });
});
