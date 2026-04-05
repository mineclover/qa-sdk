import { describe, it, expect } from "vitest";
import { extractTableRefAnnotations, extractAxisAnnotations } from "./source-annotations.js";

describe("extractTableRefAnnotations", () => {
  it("JSDoc @table_ref 추출", () => {
    const source = `
/** @table_ref cart_event.actor, auth_event.actor */
export const members = sqliteTable("members", {
  id: integer("id").primaryKey(),
});
`;
    const results = extractTableRefAnnotations(source, "schema.ts");
    expect(results).toHaveLength(1);
    expect(results[0].tableId).toBe("members");
    expect(results[0].refs).toEqual(["cart_event.actor", "auth_event.actor"]);
    expect(results[0].filePath).toBe("schema.ts");
  });

  it("// 주석 @table_ref 추출", () => {
    const source = `
// @table_ref order_event.order
export const orders = sqliteTable("orders", {});
`;
    const results = extractTableRefAnnotations(source, "orders.ts");
    expect(results).toHaveLength(1);
    expect(results[0].refs).toEqual(["order_event.order"]);
  });

  it("어노테이션 없음 → 빈 배열", () => {
    const source = `export const users = sqliteTable("users", {});`;
    expect(extractTableRefAnnotations(source, "x.ts")).toHaveLength(0);
  });

  it("다중 테이블", () => {
    const source = `
/** @table_ref cart_event.target */
export const items = sqliteTable("items", {});

/** @table_ref auth_event.role */
export const roles = sqliteTable("roles", {});
`;
    const results = extractTableRefAnnotations(source, "schema.ts");
    expect(results).toHaveLength(2);
    expect(results[0].tableId).toBe("items");
    expect(results[1].tableId).toBe("roles");
  });
});

describe("extractAxisAnnotations", () => {
  it("const 배열에서 entries 추출", () => {
    const source = `
/** @axis cart_action @version v1 */
export const CART_ACTIONS = ["add", "remove", "update_qty", "clear"] as const;
`;
    const results = extractAxisAnnotations(source, "actions.ts");
    expect(results).toHaveLength(1);
    expect(results[0].axisId).toBe("cart_action");
    expect(results[0].version).toBe("v1");
    expect(results[0].entries).toEqual(["add", "remove", "update_qty", "clear"]);
  });

  it("enum에서 entries 추출", () => {
    const source = `
/** @axis role @version v3 */
export enum Role {
  Admin = "admin",
  Editor = "editor",
  Viewer = "viewer",
}
`;
    const results = extractAxisAnnotations(source, "role.ts");
    expect(results).toHaveLength(1);
    expect(results[0].entries).toEqual(["admin", "editor", "viewer"]);
  });

  it("버전 생략 시 v1 기본", () => {
    const source = `
/** @axis env */
export const ENVS = ["dev", "prod"] as const;
`;
    const results = extractAxisAnnotations(source, "env.ts");
    expect(results[0].version).toBe("v1");
  });

  it("어노테이션 없음 → 빈 배열", () => {
    const source = `export const ACTIONS = ["a", "b"];`;
    expect(extractAxisAnnotations(source, "x.ts")).toHaveLength(0);
  });

  it("다중 axis 추출", () => {
    const source = `
/** @axis scope @version v2 */
export const SCOPES = ["single", "pair", "multi"] as const;

/** @axis kind @version v1 */
export const KINDS = ["unit", "e2e"] as const;
`;
    const results = extractAxisAnnotations(source, "types.ts");
    expect(results).toHaveLength(2);
    expect(results[0].axisId).toBe("scope");
    expect(results[1].axisId).toBe("kind");
  });
});
