// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * sim-reporting-api 내부 PrefixCatalog.
 *
 * 본 시뮬의 canonical prefix 정의는 sim-auth-api의 auth-codec.ts이지만
 * reporting-api는 auth-api에 의존하지 않는다 — 동일 unionvariant 구조를
 * 여기서도 선언한다. drift 방지 책임은 Plan 14b의 coverage spec에 추적.
 *
 * prefix별 shape / labels 정의는 "결정론적 codec" — 동일 변경이 auth-codec.ts에
 * 반영될 때 본 파일도 동기화해야 한다.
 */

import { DisjointUnionIndex } from "weighted-index";
import type {
  PrefixCatalog,
  PrefixDescriptor,
} from "./density.service.js";

const USER_ACTIONS = ["login", "logout", "refresh"] as const;
const ROLE_ACTIONS = ["assign", "revoke"] as const;
const DEPT_ACTIONS = ["manage_users", "budget_request"] as const;
const BITMAP_ACTIONS = ["issue", "refresh", "invalidate"] as const;

/** sim.bitmap@uv1 — auth-codec.ts의 authUnion과 동일 구조. */
function buildSimBitmapDescriptor(): PrefixDescriptor {
  const union = new DisjointUnionIndex([
    {
      kind: "user_action",
      shape: [USER_ACTIONS.length],
      labels: ["action"],
    },
    {
      kind: "role_action",
      shape: [ROLE_ACTIONS.length],
      labels: ["action"],
    },
    {
      kind: "dept_action",
      shape: [DEPT_ACTIONS.length],
      labels: ["action"],
    },
    {
      kind: "bitmap_action",
      shape: [BITMAP_ACTIONS.length],
      labels: ["action"],
    },
  ]);
  return {
    id: "sim.bitmap",
    version: "uv1",
    union,
    axes: [
      { name: "user_action", labels: USER_ACTIONS },
      { name: "role_action", labels: ROLE_ACTIONS },
      { name: "dept_action", labels: DEPT_ACTIONS },
      { name: "bitmap_action", labels: BITMAP_ACTIONS },
    ],
    coordsOneBased: true,
  };
}

const DESCRIPTORS = new Map<string, PrefixDescriptor>([
  ["sim.bitmap", buildSimBitmapDescriptor()],
]);

export function createSimPrefixCatalog(): PrefixCatalog {
  return {
    async resolve(id: string): Promise<PrefixDescriptor | null> {
      return DESCRIPTORS.get(id) ?? null;
    },
  };
}

/** 외부 노출 (테스트 + 디버깅). */
export const SIM_PREFIX_IDS: readonly string[] = Array.from(DESCRIPTORS.keys());
