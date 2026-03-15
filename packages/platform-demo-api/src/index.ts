import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  svcCodec, permCodecV2, evtCodecV2,
  ENV_KO, REGION_KO, SVC_NAME_KO, NS_KO, ROLE_KO, EVT_KO,
  ENVS, REGIONS, SVCS, NSS, ROLES, EVENTS, INITIATORS,
  PERM_SVC_VALUES, EVT_SVC_VALUES,
} from "./registry.js";

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

// ── App ────────────────────────────────────────────────────────────────────

const app = new Hono();

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

    // Collect fixed dims from query params (fix_<dimName>=<1-based-pos>)
    const fixedDims = ALL_SVC_DIMS.filter((d) => d !== xDim && d !== yDim);
    const fixed: Record<SvcDimKey, number> = { env: 1, region: 1, svc_name: 1, namespace: 1 };

    for (const dim of fixedDims) {
      const raw = c.req.query(`fix_${dim}`);
      if (raw !== undefined) {
        const pos = parseInt(raw, 10);
        if (!isNaN(pos) && pos >= 1 && pos <= DIM_ENTRIES[dim].length) {
          fixed[dim] = pos;
        }
      }
    }

    const xEntries = DIM_ENTRIES[xDim];
    const yEntries = DIM_ENTRIES[yDim];

    const xLabels = xEntries.map((id, i) => ({
      id,
      ko: DIM_KO_FNS[xDim](id),
      pos: i + 1,
    }));

    const yLabels = yEntries.map((id, i) => ({
      id,
      ko: DIM_KO_FNS[yDim](id),
      pos: i + 1,
    }));

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
        const value = computeSvcValue(
          indices.env, indices.region, indices.svc_name, indices.namespace
        );
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
    const svcLabels = PERM_SVC_VALUES.map((svcValue, si) => {
      const { env, region, svc_name, namespace } = decodeSvcValue(svcValue);
      return {
        pos: si + 1,
        svcValue,
        svcName: SVC_NAME_KO[svc_name] ?? svc_name,
        env,
        region,
        namespace,
      };
    });

    const roleLabels = ROLES.map((role, ri) => ({
      pos: ri + 1,
      id: role,
      ko: ROLE_KO[role] ?? role,
    }));

    const cells: Array<{ svcPos: number; rolePos: number; value: number }> = [];
    for (let si = 0; si < PERM_SVC_VALUES.length; si++) {
      for (let ri = 0; ri < ROLES.length; ri++) {
        cells.push({ svcPos: si + 1, rolePos: ri + 1, value: si * 6 + ri });
      }
    }

    return c.json({ svcLabels, roleLabels, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/permission/decode/:value", (c) => {
  try {
    const raw = c.req.param("value");
    const permValue = parseInt(raw, 10);
    if (isNaN(permValue)) return c.json({ error: "Invalid value" }, 400);

    const decoded = permCodecV2.decodeValue(permValue);
    const permSvc = Number(decoded["perm_svc"]);
    const role = String(decoded["role"]);
    const svc = decodeSvcValue(permSvc);

    return c.json({
      permValue,
      perm_svc: permSvc,
      role,
      svc,
      address: `permission:v2:${permValue}`,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});

// ── Event routes ───────────────────────────────────────────────────────────

app.get("/api/event/cells", (c) => {
  try {
    const initiator = c.req.query("initiator") ?? "web";
    if (!INITIATORS.includes(initiator as typeof INITIATORS[number])) {
      return c.json({ error: "Invalid initiator" }, 400);
    }

    const initiatorPos = (INITIATORS as readonly string[]).indexOf(initiator) + 1;

    const svcLabels = EVT_SVC_VALUES.map((svcValue, si) => {
      const { env, svc_name } = decodeSvcValue(svcValue);
      return {
        pos: si + 1,
        svcValue,
        svcName: SVC_NAME_KO[svc_name] ?? svc_name,
        env,
      };
    });

    const eventLabels = EVENTS.map((evt, ei) => ({
      pos: ei + 1,
      id: evt,
      ko: EVT_KO[evt] ?? evt,
    }));

    // Weights for event:v1 — shape [10,7,2]: [14, 2, 1]
    const cells: Array<{ svcPos: number; evtPos: number; value: number }> = [];
    for (let si = 0; si < EVT_SVC_VALUES.length; si++) {
      for (let ei = 0; ei < EVENTS.length; ei++) {
        const value = si * 18 + ei * 2 + (initiatorPos - 1);
        cells.push({ svcPos: si + 1, evtPos: ei + 1, value });
      }
    }

    return c.json({ initiator, svcLabels, eventLabels, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/event/decode/:value", (c) => {
  try {
    const raw = c.req.param("value");
    const evtValue = parseInt(raw, 10);
    if (isNaN(evtValue)) return c.json({ error: "Invalid value" }, 400);

    const decoded = evtCodecV2.decodeValue(evtValue);
    const eventSvc = Number(decoded["event_svc"]);
    const eventName = String(decoded["event_name"]);
    const initiator = String(decoded["initiator"]);
    const svc = decodeSvcValue(eventSvc);

    return c.json({
      evtValue,
      event_svc: eventSvc,
      event_name: eventName,
      initiator,
      svc,
      address: `event:v2:${evtValue}`,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});

// ── Scenario / Features routes ─────────────────────────────────────────────

// Role position in the role dimension v2 (1-based, 6 roles)
const ROLE_POS: Record<string, number> = {
  admin: 1, developer: 2, operator: 3, customer: 4, viewer: 5, readonly: 6,
};

// Feature definitions v2 — permission:v2, event:v2
// permission:v2 formula: (permSvcPos-1)*6 + (rolePos-1)
// event:v2 formula:      (svcPos-1)*18 + (evtPos-1)*2 + (initiatorPos-1)
const FEATURE_DEFS = [
  { id: "product_list",          name: "상품 목록 조회", svcName: "shopping-web",     svcValue: 40, permSvcPos: 1, grantedRoles: ["admin","developer","operator","customer","viewer","readonly"] as const, successEventValue: 90,  failEventValue: null },
  { id: "order_list",            name: "주문 목록 조회", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin","developer","operator","viewer"]                       as const, successEventValue: 112, failEventValue: null },
  { id: "payment_history",       name: "결제 내역 조회", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","developer","operator"]                               as const, successEventValue: 150, failEventValue: 152  },
  { id: "payment_cancel_req",    name: "결제 취소 요청", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","customer"]                                           as const, successEventValue: 158, failEventValue: 152  },
  { id: "payment_cancel_approve",name: "결제 취소 승인", svcName: "payment",          svcValue: 46, permSvcPos: 7, grantedRoles: ["admin","operator"]                                           as const, successEventValue: 160, failEventValue: 152  },
  { id: "user_mgmt",             name: "사용자 관리",    svcName: "auth",             svcValue: 44, permSvcPos: 5, grantedRoles: ["admin"]                                                     as const, successEventValue: 138, failEventValue: 136  },
  { id: "config_change",         name: "설정 변경",      svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin"]                                                     as const, successEventValue: 120, failEventValue: 118  },
] as const;

const ROLE_LIST = ["admin", "developer", "operator", "customer", "viewer", "readonly"] as const;

// Mutable grants state — initialized from FEATURE_DEFS, modified via PATCH /api/grants
const grantState = new Map<string, Set<string>>(
  FEATURE_DEFS.map((f) => [f.id, new Set<string>(f.grantedRoles)])
);

function isGranted(featureId: string, role: string): boolean {
  return grantState.get(featureId)?.has(role) ?? false;
}

function getGrantedRoles(featureId: string): string[] {
  return [...(grantState.get(featureId) ?? [])];
}

function getGrantedRolesKo(featureId: string): string[] {
  return getGrantedRoles(featureId).map((r) => ROLE_KO[r] ?? r);
}

app.get("/api/features", (c) => {
  try {
    const features = FEATURE_DEFS.map((f) => ({
      id: f.id,
      name: f.name,
      grantedRoles:   getGrantedRoles(f.id),
      grantedRolesKo: getGrantedRolesKo(f.id),
    }));

    const roles = ROLE_LIST.map((r) => ({ id: r, ko: ROLE_KO[r] ?? r }));

    const matrix: boolean[][] = FEATURE_DEFS.map((f) =>
      ROLE_LIST.map((r) => isGranted(f.id, r))
    );

    return c.json({ features, roles, matrix });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/scenario", (c) => {
  try {
    const roleParam = c.req.query("role") ?? "viewer";
    if (!(roleParam in ROLE_POS)) {
      return c.json({ error: `Invalid role: ${roleParam}. Must be one of: ${ROLE_LIST.join(", ")}` }, 400);
    }
    const role = roleParam;
    const roleKo = ROLE_KO[role] ?? role;
    const rolePos = ROLE_POS[role]!;

    // Compute main perm addr for payment service (permSvcPos=7, payment)
    const mainPermValue = (7 - 1) * 6 + (rolePos - 1);
    const mainPermAddr = `permission:v2:${mainPermValue}`;

    const features = FEATURE_DEFS.map((f) => {
      const permValue = (f.permSvcPos - 1) * 6 + (rolePos - 1);
      const hasAccess = isGranted(f.id, role);
      return {
        id: f.id,
        name: f.name,
        svcName: f.svcName,
        svcAddr: `service:v1:${f.svcValue}`,
        hasAccess,
        permAddr: `permission:v2:${permValue}`,
        permValue,
        grantedRoles:   getGrantedRoles(f.id),
        grantedRolesKo: getGrantedRolesKo(f.id),
      };
    });

    const simulation = FEATURE_DEFS.map((f, idx) => {
      const permValue = (f.permSvcPos - 1) * 6 + (rolePos - 1);
      const hasAccess = isGranted(f.id, role);
      const permAddr  = `permission:v2:${permValue}`;

      // Granted permission addresses for this feature
      const grantedAddrs = getGrantedRoles(f.id)
        .map((r) => `permission:v2:${(f.permSvcPos - 1) * 6 + ((ROLE_POS[r] ?? 1) - 1)}`);

      const deniedReason = hasAccess
        ? `부여됨`
        : `미부여 — 허용: [${grantedAddrs.join(", ")}]`;

      // Decode svc for Korean labels
      const svcDecoded = decodeSvcValue(f.svcValue);
      const svcNameKo = SVC_NAME_KO[svcDecoded.svc_name] ?? svcDecoded.svc_name;

      // Perm step
      const permStep = {
        addr: permAddr,
        value: permValue,
        status: (hasAccess ? "ok" : "denied") as "ok" | "denied",
        svcName: f.svcName,
        svcNameKo,
        roleName: role,
        roleNameKo: roleKo,
        grantedAddrs,
        deniedReason,
      };

      // Event step
      let eventStep: {
        addr: string; value: number; status: "ok" | "denied";
        svcName: string; svcNameKo: string; eventName: string; eventNameKo: string; initiator: string;
      } | null = null;

      const evtValue = hasAccess ? f.successEventValue : f.failEventValue;
      if (evtValue !== null) {
        const evtRaw = evtCodecV2.decodeValue(evtValue);
        const evtSvcValue = Number(evtRaw["event_svc"]);
        const evtName = String(evtRaw["event_name"]);
        const evtInit = String(evtRaw["initiator"]);
        const evtSvcDecoded = decodeSvcValue(evtSvcValue);
        eventStep = {
          addr: `event:v1:${evtValue}`,
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
      role,
      roleKo,
      user: {
        name: "홍길동",
        role,
        roleKo,
        mainPermAddr,
        mainPermValue,
      },
      features,
      simulation,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

app.get("/api/grant-table", (c) => {
  try {
    const rows = FEATURE_DEFS.map((f) =>
      ROLE_LIST.map((role) => {
        const rolePos   = ROLE_POS[role]!;
        const permValue = (f.permSvcPos - 1) * 6 + (rolePos - 1);
        const granted   = isGranted(f.id, role);

        // perm_svc → service decode
        const svcValue  = PERM_SVC_VALUES[f.permSvcPos - 1]!;
        const svcInfo   = decodeSvcValue(svcValue);

        // event
        const evtValue  = granted ? f.successEventValue : f.failEventValue;
        let eventAddr: string | null = null;
        let eventValue: number | null = null;
        let eventNameKo: string | null = null;
        const eventType: "success" | "fail" | "none" = evtValue !== null ? (granted ? "success" : "fail") : "none";

        if (evtValue !== null) {
          const evtRaw  = evtCodecV2.decodeValue(evtValue);
          eventAddr     = `event:v1:${evtValue}`;
          eventValue    = evtValue;
          eventNameKo   = EVT_KO[String(evtRaw["event_name"])] ?? String(evtRaw["event_name"]);
        }

        return {
          featureId:    f.id,
          featureName:  f.name,
          permAddr:     `permission:v2:${permValue}`,
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
          grantedRoles:    getGrantedRoles(f.id),
          grantedRolesKo:  getGrantedRolesKo(f.id),
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

// ── Grant management routes ────────────────────────────────────────────────

// PATCH /api/grants — single toggle
app.patch("/api/grants", async (c) => {
  try {
    const body = await c.req.json<{ featureId: string; role: string; granted: boolean }>();
    const { featureId, role, granted } = body;
    if (!grantState.has(featureId)) return c.json({ error: "Unknown featureId" }, 400);
    if (!(ROLE_LIST as readonly string[]).includes(role)) return c.json({ error: "Unknown role" }, 400);

    if (granted) {
      grantState.get(featureId)!.add(role);
    } else {
      grantState.get(featureId)!.delete(role);
    }

    return c.json({
      featureId,
      grantedRoles:   getGrantedRoles(featureId),
      grantedRolesKo: getGrantedRolesKo(featureId),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// PATCH /api/grants/batch — apply multiple changes at once
app.patch("/api/grants/batch", async (c) => {
  try {
    const body = await c.req.json<{ changes: Array<{ featureId: string; role: string; granted: boolean }> }>();
    for (const change of body.changes) {
      const { featureId, role, granted } = change;
      if (!grantState.has(featureId) || !(ROLE_LIST as readonly string[]).includes(role)) continue;
      if (granted) {
        grantState.get(featureId)!.add(role);
      } else {
        grantState.get(featureId)!.delete(role);
      }
    }
    const result: Record<string, string[]> = {};
    for (const f of FEATURE_DEFS) {
      result[f.id] = getGrantedRoles(f.id);
    }
    return c.json({ grants: result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// POST /api/grants/reset — restore to FEATURE_DEFS defaults
app.post("/api/grants/reset", (c) => {
  for (const f of FEATURE_DEFS) {
    grantState.set(f.id, new Set<string>(f.grantedRoles));
  }
  return c.json({ ok: true });
});

export default app;
