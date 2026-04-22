import { describe, expect, it } from "vitest";
import { computeUserBits } from "./compute-user-bits.js";
import {
  encodeAction,
  USER_ACTIONS,
  DEPT_ACTIONS,
  AUTH_BITMASK_BYTES,
} from "./auth-codec.js";
import type { Role, RoleAssignment } from "./types.js";

const baseRole = (
  id: string,
  scopeType: "global" | "department" | "project",
  defaultMaskHex: string,
): Role => ({
  id,
  name: id,
  scopeType,
  defaultMaskHex,
  createdAt: "2026-04-22T00:00:00Z",
});

const baseAssign = (
  userId: string,
  roleId: string,
  scopeType: "global" | "department" | "project",
  scopeId: string | null,
): RoleAssignment => ({
  userId,
  roleId,
  scopeType,
  scopeId,
  assignedAt: "2026-04-22T00:00:00Z",
});

describe("computeUserBits", () => {
  it("global scope role → 모든 ACTION 비트 set (admin)", () => {
    const adminMask = "ff".repeat(AUTH_BITMASK_BYTES);
    const roles = new Map([["admin", baseRole("admin", "global", adminMask)]]);
    const assignments = [baseAssign("user-1", "admin", "global", null)];
    const mask = computeUserBits({ assignments, roles });
    for (const b of mask) expect(b).toBe(0xff);
  });

  it("user_action.login만 가진 role → 해당 비트만 set", () => {
    const loginAddr = encodeAction("user_action", USER_ACTIONS.indexOf("login"));
    const loginMask = setBitToHex(loginAddr);
    const roles = new Map([["member", baseRole("member", "project", loginMask)]]);
    const assignments = [baseAssign("user-1", "member", "project", "proj-1")];
    const mask = computeUserBits({ assignments, roles });
    expect(getBit(mask, loginAddr)).toBe(true);
    // 인접 비트 중 aliasing 없는지 확인 (loginAddr 다음 주소가 아직 존재하면 false여야)
    const nextAddr = loginAddr + 1;
    if (nextAddr < AUTH_BITMASK_BYTES * 8) {
      expect(getBit(mask, nextAddr)).toBe(false);
    }
  });

  it("dept_action.budget_request — mask OR union", () => {
    const reqAddr = encodeAction("dept_action", DEPT_ACTIONS.indexOf("budget_request"));
    const reqMask = setBitToHex(reqAddr);
    const roles = new Map([["dept_mgr", baseRole("dept_mgr", "department", reqMask)]]);
    const assignments = [baseAssign("user-1", "dept_mgr", "department", "dept-eng")];
    const mask = computeUserBits({ assignments, roles });
    expect(getBit(mask, reqAddr)).toBe(true);
  });

  it("여러 RoleAssignment union — 비트 OR", () => {
    const loginAddr = encodeAction("user_action", USER_ACTIONS.indexOf("login"));
    const reqAddr = encodeAction("dept_action", DEPT_ACTIONS.indexOf("budget_request"));
    const roles = new Map([
      ["member", baseRole("member", "project", setBitToHex(loginAddr))],
      ["dept_mgr", baseRole("dept_mgr", "department", setBitToHex(reqAddr))],
    ]);
    const assignments = [
      baseAssign("user-1", "member", "project", "proj-1"),
      baseAssign("user-1", "dept_mgr", "department", "dept-eng"),
    ];
    const mask = computeUserBits({ assignments, roles });
    expect(getBit(mask, loginAddr)).toBe(true);
    expect(getBit(mask, reqAddr)).toBe(true);
  });

  it("RoleAssignment의 role이 roles map에 없으면 무시", () => {
    const roles = new Map<string, Role>();
    const assignments = [baseAssign("user-1", "missing", "project", "proj-1")];
    const mask = computeUserBits({ assignments, roles });
    for (const b of mask) expect(b).toBe(0);
  });

  it("mask 길이는 AUTH_BITMASK_BYTES와 일치", () => {
    const roles = new Map<string, Role>();
    const mask = computeUserBits({ assignments: [], roles });
    expect(mask.length).toBe(AUTH_BITMASK_BYTES);
  });
});

// helpers — 비트 단위 검증
function setBitToHex(bitIndex: number): string {
  const bytes = new Uint8Array(AUTH_BITMASK_BYTES);
  bytes[Math.floor(bitIndex / 8)] |= 1 << (bitIndex % 8);
  return Buffer.from(bytes).toString("hex");
}

function getBit(mask: Uint8Array, bitIndex: number): boolean {
  return (mask[Math.floor(bitIndex / 8)] & (1 << (bitIndex % 8))) !== 0;
}
