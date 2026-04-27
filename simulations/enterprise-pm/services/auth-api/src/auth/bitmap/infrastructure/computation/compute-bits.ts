// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { AUTH_BITMASK_BYTES } from "../codec/auth-codec.js";
import type { RoleAssignmentViewForBitmap } from "../../application/ports/role-assignment-query.port.js";
import type { RoleViewForBitmap } from "../../application/ports/role-query.port.js";

/**
 * 사용자의 RoleAssignment 목록을 기반으로 sim.bitmap mask 를 계산한다.
 *
 * 알고리즘은 shared/compute-user-bits 와 동일 (defaultMaskHex OR-union) 이며,
 * bitmap 슬라이스는 본 슬라이스 내부 view 타입에 맞춘 형태로 재구현한다
 * (cross-domain port 만 의존).
 */
export function computeBitsFor(
  assignments: readonly RoleAssignmentViewForBitmap[],
  roles: ReadonlyMap<string, RoleViewForBitmap>,
): Uint8Array {
  const accumulator = new Uint8Array(AUTH_BITMASK_BYTES);
  for (const assignment of assignments) {
    const role = roles.get(assignment.roleId);
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
