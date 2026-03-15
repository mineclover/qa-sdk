import { MetaRegistry } from "index-meta";
import {
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS, DEMO_KO,
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2,
  DEMO_INITIATORS,
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
} from "weighted-index";

// ── Service address constants ──────────────────────────────────────────────
// value formula: (env_pos-1)*20 + (region_pos-1)*10 + (name_pos-1)*2 + (ns_pos-1)
// env:    [dev,stage,prod,test,local] → pos 1-5
// region: [asia,usa]                  → pos 1-2
// svc:    [shopping-web,shopping-backend,auth,payment,gateway] → pos 1-5
// ns:     [shop,cms]                  → pos 1-2

export const SVC = {
  DEV_ASIA_SHOPPING_WEB_SHOP: 0,
  DEV_ASIA_SHOPPING_BACKEND_SHOP: 2,
  DEV_ASIA_AUTH_SHOP: 4,
  DEV_ASIA_PAYMENT_SHOP: 6,
  DEV_ASIA_GATEWAY_SHOP: 8,
  PROD_ASIA_SHOPPING_WEB_SHOP: 40,
  PROD_ASIA_SHOPPING_BACKEND_SHOP: 42,
  PROD_ASIA_AUTH_SHOP: 44,
  PROD_ASIA_PAYMENT_SHOP: 46,
  PROD_ASIA_GATEWAY_SHOP: 48,
  PROD_ASIA_SHOPPING_WEB_CMS: 41,
  PROD_ASIA_SHOPPING_BACKEND_CMS: 43,
  PROD_ASIA_AUTH_CMS: 45,
  PROD_ASIA_PAYMENT_CMS: 47,
  PROD_ASIA_GATEWAY_CMS: 49,
} as const;

// ── MetaRegistry ────────────────────────────────────────────────────────────

export const registry = new MetaRegistry({
  dims: {
    env: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["dev", "stage", "prod", "test", "local"] },
      },
    },
    region: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["asia", "usa"] },
      },
    },
    svc_name: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"] },
      },
    },
    namespace: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["shop", "cms"] },
      },
    },
    // Permission dims
    perm_svc: {
      kind: { type: "index_ref", indexId: "service" },
      snapshots: {
        v1: {
          // entries = service index values for prod/asia services
          // prod/asia/shopping-web/shop=40, prod/asia/shopping-web/cms=41, ...
          entries: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
          entryRefs: {
            1:  { indexId: "service", versionId: "v1" },
            2:  { indexId: "service", versionId: "v1" },
            3:  { indexId: "service", versionId: "v1" },
            4:  { indexId: "service", versionId: "v1" },
            5:  { indexId: "service", versionId: "v1" },
            6:  { indexId: "service", versionId: "v1" },
            7:  { indexId: "service", versionId: "v1" },
            8:  { indexId: "service", versionId: "v1" },
            9:  { indexId: "service", versionId: "v1" },
            10: { indexId: "service", versionId: "v1" },
          },
        },
      },
    },
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "developer", "operator", "viewer", "readonly"] },
        v2: { entries: ["admin", "developer", "operator", "customer", "viewer", "readonly"] },
      },
    },
    // Event dims
    event_svc: {
      kind: { type: "index_ref", indexId: "service" },
      snapshots: {
        v1: {
          // dev/asia/shop services + prod/asia/shop services
          entries: [0, 2, 4, 6, 8, 40, 42, 44, 46, 48],
          entryRefs: {
            1:  { indexId: "service", versionId: "v1" },
            2:  { indexId: "service", versionId: "v1" },
            3:  { indexId: "service", versionId: "v1" },
            4:  { indexId: "service", versionId: "v1" },
            5:  { indexId: "service", versionId: "v1" },
            6:  { indexId: "service", versionId: "v1" },
            7:  { indexId: "service", versionId: "v1" },
            8:  { indexId: "service", versionId: "v1" },
            9:  { indexId: "service", versionId: "v1" },
            10: { indexId: "service", versionId: "v1" },
          },
        },
      },
    },
    event_name: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: [
            "user.login",
            "user.logout",
            "order.created",
            "order.paid",
            "payment.failed",
            "session.expired",
            "config.changed",
          ],
        },
        v2: {
          entries: [
            "user.login",
            "user.logout",
            "order.created",
            "order.paid",
            "payment.failed",
            "session.expired",
            "config.changed",
            "payment.cancel_requested",
            "payment.cancel_approved",
          ],
        },
      },
    },
    initiator: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["web", "mobile"] },
      },
    },
  },
  indices: {
    service: {
      dims: ["env", "region", "svc_name", "namespace"],
      versions: {
        v1: {
          snapshots: {
            env: "v1",
            region: "v1",
            svc_name: "v1",
            namespace: "v1",
          },
        },
      },
    },
    permission: {
      dims: ["perm_svc", "role"],
      versions: {
        v1: {
          snapshots: {
            perm_svc: "v1",
            role: "v1",
          },
        },
        v2: {
          snapshots: {
            perm_svc: "v1",
            role: "v2",
          },
        },
      },
    },
    event: {
      dims: ["event_svc", "event_name", "initiator"],
      versions: {
        v1: {
          snapshots: {
            event_svc: "v1",
            event_name: "v1",
            initiator: "v1",
          },
        },
        v2: {
          snapshots: {
            event_svc: "v1",
            event_name: "v2",
            initiator: "v1",
          },
        },
      },
    },
  },
});

export const svcCodec    = registry.createCodec("service",    "v1");
export const permCodec   = registry.createCodec("permission", "v1");
export const evtCodec    = registry.createCodec("event",      "v1");
export const permCodecV2 = registry.createCodec("permission", "v2");
export const evtCodecV2  = registry.createCodec("event",      "v2");

// ── Label helpers ──────────────────────────────────────────────────────────
// env, region, ns, role, initiator 라벨은 demo-snapshot과 동일
export const ENV_KO    = DEMO_KO.env;
export const REGION_KO = DEMO_KO.region;
export const NS_KO     = DEMO_KO.ns;
export const ROLE_KO   = DEMO_KO.role;
export const INIT_KO   = DEMO_KO.initiator;

// svc_name, event 라벨은 API 표시용으로 별도 유지 (SSOT과 표기 차이)
export const SVC_NAME_KO: Record<string, string> = {
  "shopping-web":     "쇼핑 웹",
  "shopping-backend": "쇼핑 백엔드",
  auth:               "인증",
  payment:            "결제",
  gateway:            "게이트웨이",
};

export const EVT_KO: Record<string, string> = {
  "user.login":               "로그인",
  "user.logout":              "로그아웃",
  "order.created":            "주문 생성",
  "order.paid":               "주문 결제",
  "payment.failed":           "결제 실패",
  "session.expired":          "세션 만료",
  "config.changed":           "설정 변경",
  "payment.cancel_requested": "취소 요청",
  "payment.cancel_approved":  "취소 승인",
};

// ── Dimension entry arrays (re-exported from weighted-index demo-snapshot) ──

export const ENVS       = DEMO_ENVS;
export const REGIONS    = DEMO_REGIONS;
export const SVCS       = DEMO_SVCS;
export const NSS        = DEMO_NSS;
export const ROLES_V1   = DEMO_ROLES_V1;
export const ROLES      = DEMO_ROLES_V2;
export const EVENTS_V1  = DEMO_EVENTS_V1;
export const EVENTS     = DEMO_EVENTS_V2;
export const INITIATORS = DEMO_INITIATORS;

export const PERM_SVC_VALUES = DEMO_PERM_SVC_VALUES;
export const EVT_SVC_VALUES  = DEMO_EVT_SVC_VALUES;
