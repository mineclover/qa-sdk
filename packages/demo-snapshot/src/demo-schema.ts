/**
 * demo-schema.ts — 데모 시나리오의 상위 스키마 정의.
 *
 * 차원 데이터(demo-snapshot.ts) 위에 구축되는
 * SVC 주소 상수, Feature 정의, MetaRegistry 입력을 제공한다.
 */

import {
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS,
  DEMO_ROLES_V1, DEMO_ROLES_V2, DEMO_ROLES_V3, DEMO_ROLES_V4,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2,
  DEMO_INITIATORS,
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
  demoEncodeSvc,
  type DemoVer,
} from "./demo-snapshot.js";

// ── SVC 주소 상수 ────────────────────────────────────────────────────────────

export const DEMO_SVC = {
  DEV_ASIA_SHOPPING_WEB_SHOP:      demoEncodeSvc([1, 1, 1, 1]),
  DEV_ASIA_SHOPPING_BACKEND_SHOP:  demoEncodeSvc([1, 1, 2, 1]),
  DEV_ASIA_AUTH_SHOP:              demoEncodeSvc([1, 1, 3, 1]),
  DEV_ASIA_PAYMENT_SHOP:          demoEncodeSvc([1, 1, 4, 1]),
  DEV_ASIA_GATEWAY_SHOP:          demoEncodeSvc([1, 1, 5, 1]),
  PROD_ASIA_SHOPPING_WEB_SHOP:    demoEncodeSvc([3, 1, 1, 1]),
  PROD_ASIA_SHOPPING_BACKEND_SHOP:demoEncodeSvc([3, 1, 2, 1]),
  PROD_ASIA_AUTH_SHOP:            demoEncodeSvc([3, 1, 3, 1]),
  PROD_ASIA_PAYMENT_SHOP:         demoEncodeSvc([3, 1, 4, 1]),
  PROD_ASIA_GATEWAY_SHOP:         demoEncodeSvc([3, 1, 5, 1]),
  PROD_ASIA_SHOPPING_WEB_CMS:    demoEncodeSvc([3, 1, 1, 2]),
  PROD_ASIA_SHOPPING_BACKEND_CMS: demoEncodeSvc([3, 1, 2, 2]),
  PROD_ASIA_AUTH_CMS:             demoEncodeSvc([3, 1, 3, 2]),
  PROD_ASIA_PAYMENT_CMS:          demoEncodeSvc([3, 1, 4, 2]),
  PROD_ASIA_GATEWAY_CMS:          demoEncodeSvc([3, 1, 5, 2]),
} as const;

// ── Role positions ───────────────────────────────────────────────────────────

function buildRolePos(roles: readonly string[]): Record<string, number> {
  const pos: Record<string, number> = {};
  for (let i = 0; i < roles.length; i++) pos[roles[i]] = i + 1;
  return pos;
}

export const DEMO_ROLE_POS_V1 = buildRolePos(DEMO_ROLES_V1);
export const DEMO_ROLE_POS_V2 = buildRolePos(DEMO_ROLES_V2);
export const DEMO_ROLE_POS_V3 = buildRolePos(DEMO_ROLES_V3);
export const DEMO_ROLE_POS_V4 = buildRolePos(DEMO_ROLES_V4);

const ROLE_POS_BY_VER = { v1: DEMO_ROLE_POS_V1, v2: DEMO_ROLE_POS_V2, v3: DEMO_ROLE_POS_V3, v4: DEMO_ROLE_POS_V4 } as const;
export function demoRolePos(ver: DemoVer) { return ROLE_POS_BY_VER[ver]; }

// ── Feature definitions ──────────────────────────────────────────────────────

export interface DemoFeatureDef {
  readonly id: string;
  readonly name: string;
  readonly svcName: string;
  readonly svcValue: number;
  readonly permSvcPos: number;
  readonly grantedRoles: readonly string[];
  readonly successEventValue: number | null;
  readonly failEventValue: number | null;
}

export const DEMO_FEATURES_V1: readonly DemoFeatureDef[] = [
  { id: "product_list",    name: "상품 목록 조회", svcName: "shopping-web",     svcValue: 40, permSvcPos: 1, grantedRoles: ["admin","developer","operator","viewer","readonly"], successEventValue: 70,   failEventValue: null },
  { id: "order_list",      name: "주문 목록 조회", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin","developer","operator","viewer"],              successEventValue: 88,   failEventValue: null },
  { id: "payment_history", name: "결제 내역 조회", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"],                      successEventValue: 118,  failEventValue: 120  },
  { id: "payment_cancel",  name: "결제 취소",      svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"],                      successEventValue: null, failEventValue: 120  },
  { id: "user_mgmt",       name: "사용자 관리",    svcName: "auth",             svcValue: 44, permSvcPos: 5, grantedRoles: ["admin"],                                            successEventValue: 110,  failEventValue: 108  },
  { id: "config_change",   name: "설정 변경",      svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin"],                                            successEventValue: 96,   failEventValue: 94   },
];

export const DEMO_FEATURES_V2: readonly DemoFeatureDef[] = [
  // ── v1에서 유지 (순서 보존, payment_cancel 제외) ──
  { id: "product_list",          name: "상품 목록 조회", svcName: "shopping-web",     svcValue: 40, permSvcPos: 1, grantedRoles: ["admin","developer","operator","viewer","readonly","customer"], successEventValue: 90,   failEventValue: null },
  { id: "order_list",            name: "주문 목록 조회", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin","developer","operator","viewer"],                       successEventValue: 112,  failEventValue: null },
  { id: "payment_history",       name: "결제 내역 조회", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"],                               successEventValue: 150,  failEventValue: 152  },
  { id: "user_mgmt",             name: "사용자 관리",    svcName: "auth",             svcValue: 44, permSvcPos: 5, grantedRoles: ["admin"],                                                     successEventValue: 138,  failEventValue: 136  },
  { id: "config_change",         name: "설정 변경",      svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin"],                                                     successEventValue: 120,  failEventValue: 118  },
  // ── v2 신규 (append-only: 기존 뒤에 추가) ──
  { id: "payment_cancel_req",    name: "결제 취소 요청", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","customer"],                                           successEventValue: 158,  failEventValue: 152  },
  { id: "payment_cancel_approve",name: "결제 취소 승인", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","operator"],                                           successEventValue: 160,  failEventValue: 152  },
];

// v3: v2와 동일 entries (capacity만 확장, headroom 추가)
export const DEMO_FEATURES_V3 = DEMO_FEATURES_V2;

// v4: v3 capacity 내에서 항목 추가 (stride 불변)
export const DEMO_FEATURES_V4: readonly DemoFeatureDef[] = [
  ...DEMO_FEATURES_V3,
  // ── v4 신규 (append-only: v3 capacity 내) ──
  { id: "audit_log", name: "감사 로그", svcName: "auth", svcValue: 44, permSvcPos: 5, grantedRoles: ["admin","auditor"], successEventValue: null, failEventValue: null },
];

/** Feature capacity (feature 차원 shape 크기). v3/v4는 capacity 10으로 headroom 확보. */
export const DEMO_FEATURE_CAP = { v1: 6, v2: 7, v3: 10, v4: 10 } as const;

const FEATURES_BY_VER = { v1: DEMO_FEATURES_V1, v2: DEMO_FEATURES_V2, v3: DEMO_FEATURES_V3, v4: DEMO_FEATURES_V4 } as const;
export function demoFeatures(ver: DemoVer) { return FEATURES_BY_VER[ver]; }

export const DEMO_FEATURE_KO: Record<string, string> = {
  product_list: "상품 목록", order_list: "주문 목록",
  payment_history: "결제 내역", payment_cancel: "결제 취소",
  payment_cancel_req: "취소 요청", payment_cancel_approve: "취소 승인",
  user_mgmt: "사용자 관리", config_change: "설정 변경",
  audit_log: "감사 로그",
};

// ── MetaRegistry 입력 빌더 ───────────────────────────────────────────────────

function buildEntryRefs(count: number) {
  const refs: Record<number, { indexId: string; versionId: string }> = {};
  for (let i = 1; i <= count; i++) refs[i] = { indexId: "service", versionId: "v1" };
  return refs;
}

/** MetaRegistry 생성에 필요한 순수 데이터 객체를 반환한다. */
export function buildDemoRegistryInput() {
  return {
    dims: {
      env:       { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: [...DEMO_ENVS] } } },
      region:    { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: [...DEMO_REGIONS] } } },
      svc_name:  { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: [...DEMO_SVCS] } } },
      namespace: { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: [...DEMO_NSS] } } },
      perm_svc: {
        kind: { type: "index_ref" as const, indexId: "service" },
        snapshots: { v1: { entries: [...DEMO_PERM_SVC_VALUES], entryRefs: buildEntryRefs(DEMO_PERM_SVC_VALUES.length) } },
      },
      role: {
        kind: { type: "string_enum" as const },
        snapshots: {
          v1: { entries: [...DEMO_ROLES_V1] },
          v2: { entries: [...DEMO_ROLES_V2] },
        },
      },
      event_svc: {
        kind: { type: "index_ref" as const, indexId: "service" },
        snapshots: { v1: { entries: [...DEMO_EVT_SVC_VALUES], entryRefs: buildEntryRefs(DEMO_EVT_SVC_VALUES.length) } },
      },
      event_name: {
        kind: { type: "string_enum" as const },
        snapshots: {
          v1: { entries: [...DEMO_EVENTS_V1] },
          v2: { entries: [...DEMO_EVENTS_V2] },
        },
      },
      initiator: { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: [...DEMO_INITIATORS] } } },
    },
    indices: {
      service: {
        dims: ["env", "region", "svc_name", "namespace"],
        versions: { v1: { snapshots: { env: "v1", region: "v1", svc_name: "v1", namespace: "v1" } } },
      },
      permission: {
        dims: ["perm_svc", "role"],
        versions: {
          v1: { snapshots: { perm_svc: "v1", role: "v1" } },
          v2: { snapshots: { perm_svc: "v1", role: "v2" } },
        },
      },
      event: {
        dims: ["event_svc", "event_name", "initiator"],
        versions: {
          v1: { snapshots: { event_svc: "v1", event_name: "v1", initiator: "v1" } },
          v2: { snapshots: { event_svc: "v1", event_name: "v2", initiator: "v1" } },
        },
      },
    },
  };
}
