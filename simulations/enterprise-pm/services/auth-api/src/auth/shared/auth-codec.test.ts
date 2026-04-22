import { describe, expect, it } from "vitest";
import {
  authUnion,
  encodeAction,
  decodeAction,
  USER_ACTIONS,
  ROLE_ACTIONS,
  DEPT_ACTIONS,
  BITMAP_ACTIONS,
} from "./auth-codec.js";

describe("sim auth-codec — DisjointUnionIndex", () => {
  it("4 variant 등록 (user/role/dept/bitmap action)", () => {
    expect(authUnion.kinds).toEqual(["user_action", "role_action", "dept_action", "bitmap_action"]);
  });

  it("totalSize = sum of all variants (낭비 없음)", () => {
    const expected = USER_ACTIONS.length + ROLE_ACTIONS.length + DEPT_ACTIONS.length + BITMAP_ACTIONS.length;
    expect(authUnion.totalSize).toBe(expected);
  });

  it("user_action.login encode/decode round-trip", () => {
    const addr = encodeAction("user_action", USER_ACTIONS.indexOf("login"));
    const decoded = decodeAction(addr);
    expect(decoded.kind).toBe("user_action");
    expect(decoded.actionIndex).toBe(USER_ACTIONS.indexOf("login"));
  });

  it("dept_action.budget_request encode/decode round-trip", () => {
    const addr = encodeAction("dept_action", DEPT_ACTIONS.indexOf("budget_request"));
    const decoded = decodeAction(addr);
    expect(decoded.kind).toBe("dept_action");
    expect(decoded.actionIndex).toBe(DEPT_ACTIONS.indexOf("budget_request"));
  });

  it("disjoint — kind 별 address range 겹치지 않음", () => {
    const userAddr = encodeAction("user_action", 0);
    const roleAddr = encodeAction("role_action", 0);
    const deptAddr = encodeAction("dept_action", 0);
    const bmAddr = encodeAction("bitmap_action", 0);
    const set = new Set([userAddr, roleAddr, deptAddr, bmAddr]);
    expect(set.size).toBe(4);
  });
});
