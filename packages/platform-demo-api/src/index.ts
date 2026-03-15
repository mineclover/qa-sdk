import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  svcCodec, permCodec, evtCodec, permCodecV2, evtCodecV2,
  ENV_KO, REGION_KO, SVC_NAME_KO, NS_KO, ROLE_KO, EVT_KO,
  ENVS, REGIONS, SVCS, NSS, ROLES, EVENTS, INITIATORS,
  PERM_SVC_VALUES, EVT_SVC_VALUES,
  ROLES_V1, EVENTS_V1,
} from "./registry.js";

// ── Codec-derived constants ──────────────────────────────────────────────
// Permission: shape [perm_svc_count, role_count]
const PERM_ROLE_COUNT_V1 = permCodec.shape[1];    // 5
const PERM_ROLE_COUNT_V2 = permCodecV2.shape[1];   // 6
// Event: shape [event_svc_count, event_name_count, initiator_count]
// svcStride = event_name_count * initiator_count
const EVT_SVC_STRIDE_V1 = evtCodec.shape[1] * evtCodec.shape[2];     // 7*2 = 14
const EVT_SVC_STRIDE_V2 = evtCodecV2.shape[1] * evtCodecV2.shape[2]; // 9*2 = 18

// ── Version helpers ─────────────────────────────────────────────────────────

type Ver = "v1" | "v2";

function parseVer(raw: string | undefined): Ver {
  return raw === "v1" ? "v1" : "v2";
}

// ── Helpers ────────────────────────────────────────────────────────────────

type SvcDimKey = "env" | "region" | "svc_name" | "namespace";

const ALL_SVC_DIMS: SvcDimKey[] = ["env", "region", "svc_name", "namespace"];

const DIM_ENTRIES: Record<SvcDimKey, readonly string[]> = {
  env:       ENVS,
  region:    REGIONS,
  svc_name:  SVCS,
  namespace: NSS,
};

const DIM_KO_FNS: Record<SvcDimKey, (v: string) => string> = {
  env:       (v) => ENV_KO[v] ?? v,
  region:    (v) => REGION_KO[v] ?? v,
  svc_name:  (v) => SVC_NAME_KO[v] ?? v,
  namespace: (v) => NS_KO[v] ?? v,
};

// Weights for service:v1 — shape [5,2,5,2]
const SVC_WEIGHTS = [20, 10, 2, 1] as const;

function computeSvcValue(
  envIdx: number, regionIdx: number, svcIdx: number, nsIdx: number
): number {
  return (envIdx - 1) * SVC_WEIGHTS[0]
    + (regionIdx - 1) * SVC_WEIGHTS[1]
    + (svcIdx - 1) * SVC_WEIGHTS[2]
    + (nsIdx - 1) * SVC_WEIGHTS[3];
}

function decodeSvcValue(value: number): { env: string; region: string; svc_name: string; namespace: string } {
  const decoded = svcCodec.decodeValue(value);
  return {
    env:       String(decoded["env"]),
    region:    String(decoded["region"]),
    svc_name:  String(decoded["svc_name"]),
    namespace: String(decoded["namespace"]),
  };
}

// ── v2 Scenario / Features constants ──────────────────────────────────────

const ROLE_POS: Record<string, number> = {
  admin: 1, developer: 2, operator: 3, customer: 4, viewer: 5, readonly: 6,
};

const FEATURE_DEFS = [
  { id: "product_list",          name: "상품 목록 조회", svcName: "shopping-web",     svcValue: 40, permSvcPos: 1, grantedRoles: ["admin","developer","operator","customer","viewer","readonly"] as const, successEventValue: 90  as number | null, failEventValue: null as number | null },
  { id: "order_list",            name: "주문 목록 조회", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin","developer","operator","viewer"]                       as const, successEventValue: 112 as number | null, failEventValue: null as number | null },
  { id: "payment_history",       name: "결제 내역 조회", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"]                               as const, successEventValue: 150 as number | null, failEventValue: 152  as number | null },
  { id: "payment_cancel_req",    name: "결제 취소 요청", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","customer"]                                           as const, successEventValue: 158 as number | null, failEventValue: 152  as number | null },
  { id: "payment_cancel_approve",name: "결제 취소 승인", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","operator"]                                           as const, successEventValue: 160 as number | null, failEventValue: 152  as number | null },
  { id: "user_mgmt",             name: "사용자 관리",    svcName: "auth",             svcValue: 44, permSvcPos: 5, grantedRoles: ["admin"]                                                     as const, successEventValue: 138 as number | null, failEventValue: 136  as number | null },
  { id: "config_change",         name: "설정 변경",      svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin"]                                                     as const, successEventValue: 120 as number | null, failEventValue: 118  as number | null },
];

const ROLE_LIST = ["admin", "developer", "operator", "customer", "viewer", "readonly"] as const;

// ── v1 Scenario / Features constants ──────────────────────────────────────

const ROLE_POS_V1: Record<string, number> = {
  admin: 1, developer: 2, operator: 3, viewer: 4, readonly: 5,
};

const ROLE_LIST_V1 = ["admin", "developer", "operator", "viewer", "readonly"] as const;

// v1 event values: stride=14 (7 events × 2 initiators)
// product_list:    evtSvc=6(shopping-web:40),  evt=user.login(1)   → (6-1)*14 + (1-1)*2 + 0 = 70
// order_list:      evtSvc=7(shopping-backend:42), evt=order.created(3) → (7-1)*14 + (3-1)*2 + 0 = 88
// payment_history: evtSvc=9(payment:46),       evt=order.paid(4)   → (9-1)*14 + (4-1)*2 + 0 = 118, fail: payment.failed(5) → 120
// payment_cancel:  evtSvc=9, no cancel event in v1 → success=null, fail: payment.failed(5) → 120
// user_mgmt:       evtSvc=8(auth:44),          evt=config.changed(7) → (8-1)*14 + (7-1)*2 + 0 = 110, fail: session.expired(6) → 108
// config_change:   evtSvc=7(shopping-backend:42), evt=config.changed(7) → (7-1)*14 + (7-1)*2 + 0 = 96, fail: session.expired(6) → 94
const FEATURE_DEFS_V1 = [
  { id: "product_list",    name: "상품 목록 조회", svcName: "shopping-web",     svcValue: 40, permSvcPos: 1, grantedRoles: ["admin","developer","operator","viewer","readonly"] as readonly string[], successEventValue: 70   as number | null, failEventValue: null as number | null },
  { id: "order_list",      name: "주문 목록 조회", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin","developer","operator","viewer"]              as readonly string[], successEventValue: 88   as number | null, failEventValue: null as number | null },
  { id: "payment_history", name: "결제 내역 조회", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"]                      as readonly string[], successEventValue: 118  as number | null, failEventValue: 120  as number | null },
  { id: "payment_cancel",  name: "결제 취소",      svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"]                      as readonly string[], successEventValue: null as number | null, failEventValue: 120  as number | null },
  { id: "user_mgmt",       name: "사용자 관리",    svcName: "auth",             svcValue: 44, permSvcPos: 5, grantedRoles: ["admin"]                                            as readonly string[], successEventValue: 110  as number | null, failEventValue: 108  as number | null },
  { id: "config_change",   name: "설정 변경",      svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin"]                                            as readonly string[], successEventValue: 96   as number | null, failEventValue: 94   as number | null },
];

// ── Version-aware helpers ─────────────────────────────────────────────────

function getRoles(ver: Ver)      { return ver === "v1" ? ROLES_V1 : ROLES; }
function getRoleList(ver: Ver)   { return ver === "v1" ? ROLE_LIST_V1 : ROLE_LIST; }
function getRolePos(ver: Ver)    { return ver === "v1" ? ROLE_POS_V1 : ROLE_POS; }
function getRoleStride(ver: Ver) { return ver === "v1" ? PERM_ROLE_COUNT_V1 : PERM_ROLE_COUNT_V2; }
function getEvents(ver: Ver)     { return ver === "v1" ? EVENTS_V1 : EVENTS; }
function getEvtStride(ver: Ver)  { return ver === "v1" ? EVT_SVC_STRIDE_V1 : EVT_SVC_STRIDE_V2; }
function getFeatureDefs(ver: Ver) { return ver === "v1" ? FEATURE_DEFS_V1 : FEATURE_DEFS; }
function getPermCodec(ver: Ver)  { return ver === "v1" ? permCodec : permCodecV2; }
function getEvtCodec(ver: Ver)   { return ver === "v1" ? evtCodec : evtCodecV2; }

// ── D1 grants (v2) ──────────────────────────────────────────────────────

type GrantMap = Map<string, Set<string>>;

const FEATURE_IDS = new Set(FEATURE_DEFS.map((f) => f.id));

async function loadGrants(db: D1Database): Promise<GrantMap> {
  const { results } = await db.prepare("SELECT feature_id, role FROM grants")
    .all<{ feature_id: string; role: string }>();
  const map: GrantMap = new Map();
  for (const f of FEATURE_DEFS) map.set(f.id, new Set());
  for (const row of results) map.get(row.feature_id)?.add(row.role);
  return map;
}

function isGrantedVer(ver: Ver, grants: GrantMap, featureId: string, role: string): boolean {
  if (ver === "v1") {
    const def = FEATURE_DEFS_V1.find((f) => f.id === featureId);
    return def ? def.grantedRoles.includes(role) : false;
  }
  return grants.get(featureId)?.has(role) ?? false;
}

function getGrantedRolesVer(ver: Ver, grants: GrantMap, featureId: string): string[] {
  if (ver === "v1") {
    const def = FEATURE_DEFS_V1.find((f) => f.id === featureId);
    return def ? [...def.grantedRoles] : [];
  }
  return [...(grants.get(featureId) ?? [])];
}

function getGrantedRolesKoVer(ver: Ver, grants: GrantMap, featureId: string): string[] {
  return getGrantedRolesVer(ver, grants, featureId).map((r) => ROLE_KO[r] ?? r);
}

// ── App ────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: { DB: D1Database } }>();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
}));

// GET /api/health
app.get("/api/health", (c) => c.json({ ok: true }));

// ── Service routes ─────────────────────────────────────────────────────────

app.get("/api/service/cells", (c) => {
  try {
    const xDim = c.req.query("xDim") as SvcDimKey | undefined;
    const yDim = c.req.query("yDim") as SvcDimKey | undefined;

    if (!xDim || !ALL_SVC_DIMS.includes(xDim)) {
      return c.json({ error: "Invalid or missing xDim" }, 400);
    }
    if (!yDim || !ALL_SVC_DIMS.includes(yDim)) {
      return c.json({ error: "Invalid or missing yDim" }, 400);
    }
    if (xDim === yDim) {
      return c.json({ error: "xDim and yDim must be different" }, 400);
    }

    const fixedDims = ALL_SVC_DIMS.filter((d) => d !== xDim && d !== yDim);
    const fixed: Record<SvcDimKey, number> = { env: 1, region: 1, svc_name: 1, namespace: 1 };

    for (const dim of fixedDims) {
      const raw = c.req.query(`fix_${dim}`);
      if (raw !== undefined) {
        const pos = parseInt(raw, 10);
        if (isNaN(pos) || pos < 1 || pos > DIM_ENTRIES[dim].length) {
          return c.json({ error: `fix_${dim} must be between 1 and ${DIM_ENTRIES[dim].length}, got: ${raw}` }, 400);
        }
        fixed[dim] = pos;
      }
    }

    const xEntries = DIM_ENTRIES[xDim];
    const yEntries = DIM_ENTRIES[yDim];

    const xLabels = xEntries.map((id, i) => ({ id, ko: DIM_KO_FNS[xDim](id), pos: i + 1 }));
    const yLabels = yEntries.map((id, i) => ({ id, ko: DIM_KO_FNS[yDim](id), pos: i + 1 }));

    const fixedInfo: Record<string, { id: string; ko: string; pos: number }> = {};
    for (const dim of fixedDims) {
      const pos = fixed[dim];
      const id = DIM_ENTRIES[dim][pos - 1];
      fixedInfo[dim] = { id, ko: DIM_KO_FNS[dim](id), pos };
    }

    const cells: Array<{ xPos: number; yPos: number; value: number }> = [];
    for (let yi = 0; yi < yEntries.length; yi++) {
      for (let xi = 0; xi < xEntries.length; xi++) {
        const indices: Record<SvcDimKey, number> = { ...fixed };
        indices[xDim] = xi + 1;
        indices[yDim] = yi + 1;
        const value = computeSvcValue(indices.env, indices.region, indices.svc_name, indices.namespace);
        cells.push({ xPos: xi + 1, yPos: yi + 1, value });
      }
    }

    return c.json({ xDim, yDim, xLabels, yLabels, fixed: fixedInfo, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/service/decode/:value", (c) => {
  try {
    const raw = c.req.param("value");
    const value = parseInt(raw, 10);
    if (isNaN(value)) return c.json({ error: "Invalid value" }, 400);

    const { env, region, svc_name, namespace } = decodeSvcValue(value);

    return c.json({
      env, region, svc_name, namespace,
      envKo:       ENV_KO[env]       ?? env,
      regionKo:    REGION_KO[region] ?? region,
      svcNameKo:   SVC_NAME_KO[svc_name] ?? svc_name,
      namespaceKo: NS_KO[namespace]  ?? namespace,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});

// ── Permission routes ──────────────────────────────────────────────────────

app.get("/api/permission/cells", (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const roles = getRoles(ver);
    const roleStride = getRoleStride(ver);
    const prefix = `permission:${ver}`;
    const maxValue = PERM_SVC_VALUES.length * roles.length - 1;

    const svcLabels = PERM_SVC_VALUES.map((svcValue, si) => {
      const { env, region, svc_name, namespace } = decodeSvcValue(svcValue);
      return {
        pos: si + 1, svcValue,
        svcName: SVC_NAME_KO[svc_name] ?? svc_name,
        env, region, namespace,
      };
    });

    const roleLabels = [...roles].map((role, ri) => ({
      pos: ri + 1, id: role, ko: ROLE_KO[role] ?? role,
    }));

    const cells: Array<{ svcPos: number; rolePos: number; value: number }> = [];
    for (let si = 0; si < PERM_SVC_VALUES.length; si++) {
      for (let ri = 0; ri < roles.length; ri++) {
        cells.push({ svcPos: si + 1, rolePos: ri + 1, value: si * roleStride + ri });
      }
    }

    return c.json({ ver, roleStride, prefix, maxValue, svcLabels, roleLabels, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/permission/decode/:value", (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const raw = c.req.param("value");
    const permValue = parseInt(raw, 10);
    if (isNaN(permValue)) return c.json({ error: "Invalid value" }, 400);

    const codec = getPermCodec(ver);
    const decoded = codec.decodeValue(permValue);
    const permSvc = Number(decoded["perm_svc"]);
    const role = String(decoded["role"]);
    const svc = decodeSvcValue(permSvc);

    return c.json({
      permValue, perm_svc: permSvc, role, svc,
      address: `permission:${ver}:${permValue}`,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});

// ── Event routes ───────────────────────────────────────────────────────────

app.get("/api/event/cells", (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const initiator = c.req.query("initiator") ?? "web";
    if (!INITIATORS.includes(initiator as typeof INITIATORS[number])) {
      return c.json({ error: "Invalid initiator" }, 400);
    }

    const initiatorPos = (INITIATORS as readonly string[]).indexOf(initiator) + 1;
    const events = getEvents(ver);
    const svcStride = getEvtStride(ver);
    const prefix = `event:${ver}`;
    const maxValue = EVT_SVC_VALUES.length * events.length * 2 - 1;

    const svcLabels = EVT_SVC_VALUES.map((svcValue, si) => {
      const { env, svc_name } = decodeSvcValue(svcValue);
      return { pos: si + 1, svcValue, svcName: SVC_NAME_KO[svc_name] ?? svc_name, env };
    });

    const eventLabels = [...events].map((evt, ei) => ({
      pos: ei + 1, id: evt, ko: EVT_KO[evt] ?? evt,
    }));

    const cells: Array<{ svcPos: number; evtPos: number; value: number }> = [];
    for (let si = 0; si < EVT_SVC_VALUES.length; si++) {
      for (let ei = 0; ei < events.length; ei++) {
        const value = si * svcStride + ei * 2 + (initiatorPos - 1);
        cells.push({ svcPos: si + 1, evtPos: ei + 1, value });
      }
    }

    return c.json({ ver, svcStride, prefix, maxValue, initiator, svcLabels, eventLabels, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/event/decode/:value", (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const raw = c.req.param("value");
    const evtValue = parseInt(raw, 10);
    if (isNaN(evtValue)) return c.json({ error: "Invalid value" }, 400);

    const codec = getEvtCodec(ver);
    const decoded = codec.decodeValue(evtValue);
    const eventSvc = Number(decoded["event_svc"]);
    const eventName = String(decoded["event_name"]);
    const initiator = String(decoded["initiator"]);
    const svc = decodeSvcValue(eventSvc);

    return c.json({
      evtValue, event_svc: eventSvc, event_name: eventName, initiator, svc,
      address: `event:${ver}:${evtValue}`,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});

// ── Scenario / Features routes ─────────────────────────────────────────────

app.get("/api/features", async (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const featureDefs = getFeatureDefs(ver);
    const roleList = getRoleList(ver);
    const grants = await loadGrants(c.env.DB);

    const features = featureDefs.map((f) => ({
      id: f.id, name: f.name,
      grantedRoles:   getGrantedRolesVer(ver, grants, f.id),
      grantedRolesKo: getGrantedRolesKoVer(ver, grants, f.id),
    }));

    const roles = [...roleList].map((r) => ({ id: r, ko: ROLE_KO[r] ?? r }));

    const matrix: boolean[][] = featureDefs.map((f) =>
      [...roleList].map((r) => isGrantedVer(ver, grants, f.id, r))
    );

    return c.json({ features, roles, matrix });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/scenario", async (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const roleParam = c.req.query("role") ?? "viewer";
    const rolePos_ = getRolePos(ver);
    const featureDefs = getFeatureDefs(ver);
    const roleStride = getRoleStride(ver);
    const codec = getEvtCodec(ver);

    if (!(roleParam in rolePos_)) {
      return c.json({ error: `Invalid role: ${roleParam}. Must be one of: ${[...getRoleList(ver)].join(", ")}` }, 400);
    }
    const role = roleParam;
    const roleKo = ROLE_KO[role] ?? role;
    const rolePos = rolePos_[role]!;
    const grants = await loadGrants(c.env.DB);

    const mainPermValue = (7 - 1) * roleStride + (rolePos - 1);
    const mainPermAddr = `permission:${ver}:${mainPermValue}`;

    const features = featureDefs.map((f) => {
      const permValue = (f.permSvcPos - 1) * roleStride + (rolePos - 1);
      const hasAccess = isGrantedVer(ver, grants, f.id, role);
      return {
        id: f.id, name: f.name, svcName: f.svcName,
        svcAddr: `service:v1:${f.svcValue}`,
        hasAccess,
        permAddr: `permission:${ver}:${permValue}`,
        permValue,
        grantedRoles:   getGrantedRolesVer(ver, grants, f.id),
        grantedRolesKo: getGrantedRolesKoVer(ver, grants, f.id),
      };
    });

    const simulation = featureDefs.map((f, idx) => {
      const permValue = (f.permSvcPos - 1) * roleStride + (rolePos - 1);
      const hasAccess = isGrantedVer(ver, grants, f.id, role);
      const permAddr = `permission:${ver}:${permValue}`;

      const grantedAddrs = getGrantedRolesVer(ver, grants, f.id)
        .map((r) => `permission:${ver}:${(f.permSvcPos - 1) * roleStride + ((rolePos_[r] ?? 1) - 1)}`);

      const deniedReason = hasAccess
        ? `부여됨`
        : `미부여 — 허용: [${grantedAddrs.join(", ")}]`;

      const svcDecoded = decodeSvcValue(f.svcValue);
      const svcNameKo = SVC_NAME_KO[svcDecoded.svc_name] ?? svcDecoded.svc_name;

      const permStep = {
        addr: permAddr, value: permValue,
        status: (hasAccess ? "ok" : "denied") as "ok" | "denied",
        svcName: f.svcName, svcNameKo,
        roleName: role, roleNameKo: roleKo,
        grantedAddrs, deniedReason,
      };

      let eventStep: {
        addr: string; value: number; status: "ok" | "denied";
        svcName: string; svcNameKo: string; eventName: string; eventNameKo: string; initiator: string;
      } | null = null;

      const evtValue = hasAccess ? f.successEventValue : f.failEventValue;
      if (evtValue !== null) {
        const evtRaw = codec.decodeValue(evtValue);
        const evtSvcValue = Number(evtRaw["event_svc"]);
        const evtName = String(evtRaw["event_name"]);
        const evtInit = String(evtRaw["initiator"]);
        const evtSvcDecoded = decodeSvcValue(evtSvcValue);
        eventStep = {
          addr: `event:${ver}:${evtValue}`,
          value: evtValue,
          status: hasAccess ? "ok" : "denied",
          svcName: evtSvcDecoded.svc_name,
          svcNameKo: SVC_NAME_KO[evtSvcDecoded.svc_name] ?? evtSvcDecoded.svc_name,
          eventName: evtName,
          eventNameKo: EVT_KO[evtName] ?? evtName,
          initiator: evtInit,
        };
      }

      return {
        featureNum: idx + 1,
        featureId: f.id,
        featureName: f.name,
        hasAccess,
        perm: permStep,
        event: eventStep,
      };
    });

    return c.json({
      role, roleKo,
      user: { name: "홍길동", role, roleKo, mainPermAddr, mainPermValue },
      features,
      simulation,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/grant-table", async (c) => {
  try {
    const ver = parseVer(c.req.query("ver"));
    const featureDefs = getFeatureDefs(ver);
    const roleList = getRoleList(ver);
    const rolePos_ = getRolePos(ver);
    const roleStride = getRoleStride(ver);
    const codec = getEvtCodec(ver);
    const grants = await loadGrants(c.env.DB);

    const rows = featureDefs.map((f) =>
      [...roleList].map((role) => {
        const rolePos = rolePos_[role]!;
        const permValue = (f.permSvcPos - 1) * roleStride + (rolePos - 1);
        const granted = isGrantedVer(ver, grants, f.id, role);

        const svcValue  = PERM_SVC_VALUES[f.permSvcPos - 1]!;
        const svcInfo   = decodeSvcValue(svcValue);

        const evtValue = granted ? f.successEventValue : f.failEventValue;
        let eventAddr: string | null = null;
        let eventValue: number | null = null;
        let eventNameKo: string | null = null;
        const eventType: "success" | "fail" | "none" = evtValue !== null ? (granted ? "success" : "fail") : "none";

        if (evtValue !== null) {
          const evtRaw  = codec.decodeValue(evtValue);
          eventAddr     = `event:${ver}:${evtValue}`;
          eventValue    = evtValue;
          eventNameKo   = EVT_KO[String(evtRaw["event_name"])] ?? String(evtRaw["event_name"]);
        }

        return {
          featureId:    f.id,
          featureName:  f.name,
          permAddr:     `permission:${ver}:${permValue}`,
          permValue,
          svcValue,
          svcNameKo:    SVC_NAME_KO[svcInfo.svc_name] ?? svcInfo.svc_name,
          env:          svcInfo.env,
          envKo:        ENV_KO[svcInfo.env]      ?? svcInfo.env,
          region:       svcInfo.region,
          regionKo:     REGION_KO[svcInfo.region] ?? svcInfo.region,
          namespace:    svcInfo.namespace,
          namespaceKo:  NS_KO[svcInfo.namespace] ?? svcInfo.namespace,
          role,
          roleKo:          ROLE_KO[role] ?? role,
          granted,
          grantedRoles:    getGrantedRolesVer(ver, grants, f.id),
          grantedRolesKo:  getGrantedRolesKoVer(ver, grants, f.id),
          eventAddr,
          eventValue,
          eventNameKo,
          eventType,
        };
      })
    ).flat();

    return c.json({ rows });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ── Grant management routes (v2 only) ────────────────────────────────────

app.patch("/api/grants", async (c) => {
  try {
    const body = await c.req.json<{ featureId: string; role: string; granted: boolean }>();
    const { featureId, role, granted } = body;
    if (!FEATURE_IDS.has(featureId)) return c.json({ error: "Unknown featureId" }, 400);
    if (!(ROLE_LIST as readonly string[]).includes(role)) return c.json({ error: "Unknown role" }, 400);

    const db = c.env.DB;
    if (granted) {
      await db.prepare("INSERT OR IGNORE INTO grants (feature_id, role) VALUES (?, ?)")
        .bind(featureId, role).run();
    } else {
      await db.prepare("DELETE FROM grants WHERE feature_id = ? AND role = ?")
        .bind(featureId, role).run();
    }

    const rows = await db.prepare("SELECT role FROM grants WHERE feature_id = ?")
      .bind(featureId).all<{ role: string }>();
    const grantedRoles = rows.results.map((r) => r.role);

    return c.json({
      featureId,
      grantedRoles,
      grantedRolesKo: grantedRoles.map((r) => ROLE_KO[r] ?? r),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.patch("/api/grants/batch", async (c) => {
  try {
    const body = await c.req.json<{ changes: unknown }>();

    if (!body || !Array.isArray(body.changes)) {
      return c.json({ error: "Request body must contain a 'changes' array" }, 400);
    }

    const errors: string[] = [];
    for (let i = 0; i < body.changes.length; i++) {
      const change = body.changes[i] as Record<string, unknown> | null | undefined;
      if (!change || typeof change !== "object") {
        errors.push(`changes[${i}]: must be an object`);
        continue;
      }
      if (typeof change.featureId !== "string" || !change.featureId) {
        errors.push(`changes[${i}]: missing or invalid 'featureId'`);
      } else if (!FEATURE_IDS.has(change.featureId)) {
        errors.push(`changes[${i}]: unknown featureId '${change.featureId}'`);
      }
      if (typeof change.role !== "string" || !change.role) {
        errors.push(`changes[${i}]: missing or invalid 'role'`);
      } else if (!(ROLE_LIST as readonly string[]).includes(change.role)) {
        errors.push(`changes[${i}]: unknown role '${change.role}'`);
      }
      if (typeof change.granted !== "boolean") {
        errors.push(`changes[${i}]: missing or invalid 'granted' (must be boolean)`);
      }
    }

    if (errors.length > 0) {
      return c.json({ error: "Invalid input", details: errors }, 400);
    }

    const db = c.env.DB;
    const stmts: D1PreparedStatement[] = [];
    for (const change of body.changes as Array<{ featureId: string; role: string; granted: boolean }>) {
      if (change.granted) {
        stmts.push(db.prepare("INSERT OR IGNORE INTO grants (feature_id, role) VALUES (?, ?)").bind(change.featureId, change.role));
      } else {
        stmts.push(db.prepare("DELETE FROM grants WHERE feature_id = ? AND role = ?").bind(change.featureId, change.role));
      }
    }
    if (stmts.length > 0) await db.batch(stmts);

    const grants = await loadGrants(db);
    const result: Record<string, string[]> = {};
    for (const f of FEATURE_DEFS) {
      result[f.id] = [...(grants.get(f.id) ?? [])];
    }
    return c.json({ grants: result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.post("/api/grants/reset", async (c) => {
  const db = c.env.DB;
  await db.prepare("DELETE FROM grants").run();
  const stmts = FEATURE_DEFS.flatMap((f) =>
    [...f.grantedRoles].map((r) =>
      db.prepare("INSERT INTO grants (feature_id, role) VALUES (?, ?)").bind(f.id, r)
    )
  );
  await db.batch(stmts);
  return c.json({ ok: true });
});

export default app;
