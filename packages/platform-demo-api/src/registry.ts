import { MetaRegistry } from "index-meta";

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

export const ENV_KO: Record<string, string> = {
  dev:   "개발",
  stage: "스테이지",
  prod:  "운영",
  test:  "테스트",
  local: "로컬",
};

export const REGION_KO: Record<string, string> = {
  asia: "아시아",
  usa:  "미국",
};

export const SVC_NAME_KO: Record<string, string> = {
  "shopping-web":     "쇼핑 웹",
  "shopping-backend": "쇼핑 백엔드",
  auth:               "인증",
  payment:            "결제",
  gateway:            "게이트웨이",
};

export const NS_KO: Record<string, string> = {
  shop: "쇼핑몰",
  cms:  "CMS",
};

export const ROLE_KO: Record<string, string> = {
  admin:     "관리자",
  developer: "개발자",
  operator:  "운영자",
  customer:  "고객",
  viewer:    "뷰어",
  readonly:  "읽기전용",
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

export const INIT_KO: Record<string, string> = {
  web:    "웹",
  mobile: "모바일",
};

// ── Dimension entry arrays ─────────────────────────────────────────────────

export const ROLES_V1 = ["admin", "developer", "operator", "viewer", "readonly"] as const;
export const EVENTS_V1 = [
  "user.login", "user.logout", "order.created", "order.paid",
  "payment.failed", "session.expired", "config.changed",
] as const;

export const ENVS    = ["dev", "stage", "prod", "test", "local"] as const;
export const REGIONS = ["asia", "usa"] as const;
export const SVCS    = ["shopping-web", "shopping-backend", "auth", "payment", "gateway"] as const;
export const NSS     = ["shop", "cms"] as const;
export const ROLES   = ["admin", "developer", "operator", "customer", "viewer", "readonly"] as const;
export const EVENTS  = [
  "user.login", "user.logout", "order.created", "order.paid",
  "payment.failed", "session.expired", "config.changed",
  "payment.cancel_requested", "payment.cancel_approved",
] as const;
export const INITIATORS = ["web", "mobile"] as const;

// perm_svc entries (prod/asia services)
export const PERM_SVC_VALUES = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49] as const;
// event_svc entries (dev+prod/asia/shop services)
export const EVT_SVC_VALUES  = [0, 2, 4, 6, 8, 40, 42, 44, 46, 48] as const;
