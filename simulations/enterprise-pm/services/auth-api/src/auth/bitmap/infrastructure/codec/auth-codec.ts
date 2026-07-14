// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { DisjointUnionIndex } from 'weighted-index';

/**
 * sim.bitmap prefix encoding.
 *
 * design.md §3 — 4 variant disjoint union:
 *   user_action  — login/logout/refresh
 *   role_action  — assign/revoke
 *   dept_action  — manage_users/budget_request
 *   bitmap_action — issue/refresh/invalidate
 *
 * 각 variant는 1차원 shape (action enum만). project_action은 sim.project prefix가 owns.
 *
 * NOTE: WeightedIndex의 labels는 "dimension label" (shape length와 일치)이고
 * coords는 1-based이다. USER_ACTIONS 등 value enum은 별도 배열로 유지하되
 * DisjointUnionIndex 생성 시에는 dim 이름 1개만 전달한다.
 */

export const USER_ACTIONS = ['login', 'logout', 'refresh'] as const;
export const ROLE_ACTIONS = ['assign', 'revoke'] as const;
export const DEPT_ACTIONS = ['manage_users', 'budget_request'] as const;
export const BITMAP_ACTIONS = ['issue', 'refresh', 'invalidate'] as const;

export type UserAction = (typeof USER_ACTIONS)[number];
export type RoleAction = (typeof ROLE_ACTIONS)[number];
export type DeptAction = (typeof DEPT_ACTIONS)[number];
export type BitmapAction = (typeof BITMAP_ACTIONS)[number];

export const authUnion = new DisjointUnionIndex([
  { kind: 'user_action', shape: [USER_ACTIONS.length], labels: ['action'] },
  { kind: 'role_action', shape: [ROLE_ACTIONS.length], labels: ['action'] },
  { kind: 'dept_action', shape: [DEPT_ACTIONS.length], labels: ['action'] },
  { kind: 'bitmap_action', shape: [BITMAP_ACTIONS.length], labels: ['action'] },
]);

/**
 * 0-based action index를 받아 전역 address를 반환.
 *
 * WeightedIndex coords는 1-based이지만, 호출자(compute-user-bits 등)는
 * action enum의 indexOf(0-based) 결과를 그대로 사용하는 것이 직관적이다.
 */
export function encodeAction(
  kind: 'user_action' | 'role_action' | 'dept_action' | 'bitmap_action',
  actionIndex: number,
): number {
  return authUnion.encode(kind, [actionIndex + 1]);
}

/** 역변환: 전역 address → { kind, actionIndex (0-based) }. */
export function decodeAction(address: number): {
  kind: string;
  actionIndex: number;
} {
  const decoded = authUnion.decode(address);
  return { kind: decoded.kind, actionIndex: decoded.coords[0] - 1 };
}

/** 비트마스크 capacity (byte 단위, ceil). issueBitmap 호출 시 mask 길이 결정. */
export const AUTH_BITMASK_BYTES = Math.ceil(authUnion.totalSize / 8);
