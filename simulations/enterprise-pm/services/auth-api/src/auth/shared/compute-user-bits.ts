// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { RoleAssignment, Role } from "./types.js";
import { AUTH_BITMASK_BYTES } from "./auth-codec.js";

export interface ComputeUserBitsArgs {
  /** 사용자의 모든 RoleAssignment. */
  assignments: readonly RoleAssignment[];
  /** roleId → Role 사전. assignments의 roleId가 없으면 해당 assignment 무시. */
  roles: ReadonlyMap<string, Role>;
}

/**
 * 사용자의 RoleAssignment 목록을 기반으로 sim.bitmap mask를 계산한다.
 *
 * 알고리즘:
 *   1. 빈 mask (AUTH_BITMASK_BYTES bytes, 모두 0)
 *   2. 각 assignment에 대해
 *      a. roles.get(assignment.roleId) 조회. 없으면 skip.
 *      b. role.defaultMaskHex를 Uint8Array로 디코드.
 *      c. accumulator |= roleMask  (OR union).
 *   3. mask 반환.
 *
 * scope 검증은 본 함수에서 하지 않음 — 호출자(BitmapIssuerService)가
 * scopeType/scopeId 매칭이 필요한 경우 assignments를 미리 필터링해서 전달한다.
 *
 * 순수 함수 — DB·시간·랜덤성 의존 없음. SQLite/PG 어댑터 양쪽에서 재사용.
 */
export function computeUserBits(args: ComputeUserBitsArgs): Uint8Array {
  const accumulator = new Uint8Array(AUTH_BITMASK_BYTES);

  for (const assignment of args.assignments) {
    const role = args.roles.get(assignment.roleId);
    if (!role) continue;

    const roleMask = hexToBytes(role.defaultMaskHex);
    if (roleMask.length !== AUTH_BITMASK_BYTES) {
      throw new Error(
        `Role ${role.id} mask length ${roleMask.length} mismatch (expected ${AUTH_BITMASK_BYTES})`,
      );
    }
    for (let i = 0; i < AUTH_BITMASK_BYTES; i++) {
      accumulator[i] |= roleMask[i];
    }
  }

  return accumulator;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hex string must have even length: ${hex}`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
