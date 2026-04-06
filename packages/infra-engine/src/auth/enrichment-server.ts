/**
 * Permission Enrichment Server.
 *
 * Zitadel Action에서 호출하거나, gateway에서 직접 호출하여
 * 사용자의 role에 따른 bitmask permission claims를 반환한다.
 *
 * 기능:
 * 1. role → bitmask 변환 (기본 경로)
 * 2. Zitadel user metadata에서 기존 perms 조회 (metadata 우선)
 * 3. env별 feature 제한 (ScopedEngine 경량 구현)
 * 4. Role 계층 상속 (admin > operator > viewer)
 * 5. Permission check — feature별 granted/denied + reason
 * 6. User override — 개별 feature grant/deny
 * 7. 세션 무효화 — perms_v 증가
 * 8. Explain — 권한 부여 경로 추적
 *
 * 포트: 3900 (ENRICHMENT_PORT 환경변수로 변경 가능)
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

// ── Feature 정의 ─────────────────────────────────────
// route-permissions.ts의 feature 이름과 일치해야 한다.
// 인덱스 = bitmask 내 비트 위치

const FEATURES = [
  "ingest_read",      // 0
  "ingest_write",     // 1
  "registry_read",    // 2
  "gate_read",        // 3
  "query_read",       // 4
  "decode_read",      // 5
  "definition_read",  // 6
  "definition_write", // 7
  "decision_read",    // 8
  "decision_write",   // 9
  "deploy_execute",   // 10
  "monitoring_read",  // 11
  "ingest_admin",     // 12
] as const;

type FeatureName = typeof FEATURES[number];

/** feature 이름 -> 비트 인덱스 */
const FEATURE_INDEX = Object.fromEntries(
  FEATURES.map((f, i) => [f, i]),
) as Record<FeatureName, number>;

// ── Role Registry (계층 상속) ────────────────────────

interface RoleDef {
  name: string;
  parents: string[];
  features: FeatureName[];
}

const ROLE_DEFS: Record<string, RoleDef> = {
  viewer: {
    name: "viewer",
    parents: [],
    features: [
      "ingest_read", "registry_read", "gate_read", "query_read",
      "decode_read", "definition_read", "decision_read", "monitoring_read",
    ],
  },
  operator: {
    name: "operator",
    parents: ["viewer"],
    features: [
      "ingest_write", "deploy_execute",
    ],
  },
  admin: {
    name: "admin",
    parents: ["operator"],
    features: [
      "definition_write", "decision_write", "ingest_admin",
    ],
  },
};

/** Role 계층 flatten — 부모 features 상속 (OR 합산) */
function resolveRoleFeatures(roleName: string): FeatureName[] {
  const role = ROLE_DEFS[roleName];
  if (!role) return [];
  const features = new Set<FeatureName>(role.features);
  for (const parent of role.parents) {
    for (const f of resolveRoleFeatures(parent)) features.add(f);
  }
  return [...features];
}

// 레거시 호환: ROLE_FEATURES (flat)
const ROLE_FEATURES: Record<string, readonly FeatureName[]> = Object.fromEntries(
  Object.keys(ROLE_DEFS).map((role) => [role, resolveRoleFeatures(role)]),
);

// ── Env별 Feature 제한 (ScopedEngine 경량 구현) ──────

/**
 * 환경별로 특정 role의 feature를 제한한다.
 * 키: env 이름, 값: role별 제한할 feature 목록.
 *
 * 제한 대상 feature만 기술 — 여기에 없는 role/env는 무제한.
 * "dev"는 제한 없음 (빈 객체).
 */
const ENV_RESTRICTIONS: Record<string, Record<string, FeatureName[]>> = {
  prod: {
    operator: ["deploy_execute"],
    viewer: ["deploy_execute", "ingest_write", "definition_write", "decision_write"],
  },
  staging: {
    viewer: ["ingest_write", "definition_write", "decision_write"],
  },
  dev: {},
};

/**
 * env 제한을 적용하여 feature 목록에서 차단 대상을 제거한다.
 */
function applyEnvRestrictions(
  features: readonly FeatureName[],
  role: string,
  env?: string,
): readonly FeatureName[] {
  if (!env) return features;
  const restrictions = ENV_RESTRICTIONS[env];
  if (!restrictions) return features;
  const blocked = restrictions[role];
  if (!blocked || blocked.length === 0) return features;
  const blockedSet = new Set<string>(blocked);
  return features.filter((f) => !blockedSet.has(f));
}

// ── Bitmask 유틸 ─────────────────────────────────────

/** feature 이름 목록으로 bitmask 생성 (base64) */
function createBitmask(features: readonly FeatureName[]): string {
  const byteCount = Math.ceil(FEATURES.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (const feat of features) {
    const idx = FEATURE_INDEX[feat];
    if (idx === undefined) continue;
    const byteIdx = Math.floor(idx / 8);
    const bitIdx = idx % 8;
    if (byteIdx < bytes.length) bytes[byteIdx] |= (1 << bitIdx);
  }
  return Buffer.from(bytes).toString("base64");
}

/** base64 bitmask에서 특정 feature 비트 확인 */
function hasBit(bitmaskB64: string, featureName: string): boolean {
  const idx = FEATURE_INDEX[featureName as FeatureName];
  if (idx === undefined) return false;
  const bytes = Buffer.from(bitmaskB64, "base64");
  const byteIdx = Math.floor(idx / 8);
  const bitIdx = idx % 8;
  if (byteIdx >= bytes.length) return false;
  return (bytes[byteIdx] & (1 << bitIdx)) !== 0;
}

// ── Zitadel Metadata 조회 ────────────────────────────

const ZITADEL_URL = process.env.ZITADEL_URL; // e.g., "http://localhost:8085"
const ZITADEL_SERVICE_TOKEN = process.env.ZITADEL_SERVICE_TOKEN; // admin PAT

interface ZitadelPerms {
  perms: Record<string, string>;
  perms_v: number;
  perms_schema: string;
}

/**
 * Zitadel user metadata에서 사전 저장된 perms를 조회한다.
 * 실패 시 null 반환 (fail-open).
 */
async function fetchZitadelMetadata(userId: string): Promise<ZitadelPerms | null> {
  if (!ZITADEL_URL || !ZITADEL_SERVICE_TOKEN) return null;

  try {
    const resp = await fetch(
      `${ZITADEL_URL}/management/v1/users/${userId}/metadata/_search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ZITADEL_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!resp.ok) return null;

    const meta = await resp.json() as {
      result?: Array<{ key: string; value: string }>;
    };

    let perms: Record<string, string> | undefined;
    let perms_v = 1;
    let perms_schema = "qa-v1";

    for (const m of meta.result ?? []) {
      const val = Buffer.from(m.value, "base64").toString();
      if (m.key === "perms") {
        try { perms = JSON.parse(val) as Record<string, string>; } catch { /* 무시 */ }
      }
      if (m.key === "perms_v") perms_v = parseInt(val) || 1;
      if (m.key === "perms_schema") perms_schema = val;
    }

    if (perms) return { perms, perms_v, perms_schema };
  } catch { /* metadata 조회 실패 — fail-open */ }

  return null;
}

// ── User State (인메모리) ─────────────────────────────

interface UserOverride {
  feature: string;
  granted: boolean;
}

interface UserState {
  roles: string[];
  overrides: UserOverride[];
  perms_v: number;
  active: boolean;
}

const users = new Map<string, UserState>();

function getUser(userId: string): UserState {
  if (!users.has(userId)) {
    users.set(userId, {
      roles: ["viewer"],
      overrides: [],
      perms_v: 1,
      active: true,
    });
  }
  return users.get(userId)!;
}

// ── Permission Check 로직 ────────────────────────────

interface CheckResult {
  granted: boolean;
  reason: string;
  sources: string[];
}

function checkFeature(userId: string, feature: string): CheckResult {
  const user = getUser(userId);

  // 1. 비활성 사용자 — 세션 무효화됨
  if (!user.active) {
    return { granted: false, reason: "session_invalidated", sources: [] };
  }

  // 2. Override 확인 (deny wins)
  const override = user.overrides.find((o) => o.feature === feature);
  if (override) {
    return {
      granted: override.granted,
      reason: override.granted ? "user_override_grant" : "user_override_deny",
      sources: [`override:${feature}`],
    };
  }

  // 3. Role 계층에서 feature 확인
  const grantingRoles: string[] = [];
  for (const role of user.roles) {
    const features = resolveRoleFeatures(role);
    if (features.includes(feature as FeatureName)) grantingRoles.push(role);
  }

  if (grantingRoles.length > 0) {
    return { granted: true, reason: "role_grant", sources: grantingRoles };
  }

  return { granted: false, reason: "not_assigned", sources: [] };
}

// ── Routes ───────────────────────────────────────────

// ── 유저 상태 조회 ──────────────────────────────────

app.get("/users/:userId", (c) => {
  const userId = c.req.param("userId");
  const user = getUser(userId);
  return c.json({
    userId,
    roles: user.roles,
    overrides: user.overrides,
    perms_v: user.perms_v,
    active: user.active,
  });
});

// ── Role 부여/제거 ──────────────────────────────────

app.post("/users/:userId/grant-role", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ role: string }>();
  const { role } = body;

  if (!ROLE_DEFS[role]) {
    return c.json({ error: `Unknown role: ${role}` }, 400);
  }

  const user = getUser(userId);
  if (!user.roles.includes(role)) {
    user.roles.push(role);
  }
  return c.json({ ok: true, userId, roles: user.roles });
});

app.delete("/users/:userId/revoke-role/:role", (c) => {
  const userId = c.req.param("userId");
  const role = c.req.param("role");
  const user = getUser(userId);

  const idx = user.roles.indexOf(role);
  if (idx === -1) {
    return c.json({ error: `User does not have role: ${role}` }, 404);
  }
  user.roles.splice(idx, 1);

  // 최소 1개 role 보장 (빈 roles 방지)
  if (user.roles.length === 0) {
    user.roles.push("viewer");
  }

  return c.json({ ok: true, userId, roles: user.roles });
});

// ── Permission Check ────────────────────────────────

app.post("/check", async (c) => {
  const body = await c.req.json<{
    userId: string;
    domain?: string;
    feature: string;
  }>();

  const result = checkFeature(body.userId, body.feature);
  return c.json(result);
});

// ── Explain ─────────────────────────────────────────

app.post("/explain", async (c) => {
  const body = await c.req.json<{
    userId: string;
    domain?: string;
    feature: string;
  }>();

  const user = getUser(body.userId);

  if (!user.active) {
    return c.json({
      granted: false,
      reason: "session_invalidated",
      sources: [],
      roles: user.roles,
      overrides: user.overrides,
      resolvedFeatures: {},
    });
  }

  // Override 확인
  const override = user.overrides.find((o) => o.feature === body.feature);
  if (override) {
    return c.json({
      granted: override.granted,
      reason: override.granted ? "user_override_grant" : "user_override_deny",
      sources: [`override:${body.feature}`],
      roles: user.roles,
      overrides: user.overrides,
    });
  }

  // Role별 resolved features
  const resolvedFeatures: Record<string, string[]> = {};
  const grantingRoles: string[] = [];

  for (const role of user.roles) {
    const features = resolveRoleFeatures(role);
    resolvedFeatures[role] = features;
    if (features.includes(body.feature as FeatureName)) {
      grantingRoles.push(role);
    }
  }

  return c.json({
    granted: grantingRoles.length > 0,
    reason: grantingRoles.length > 0 ? "role_grant" : "not_assigned",
    sources: grantingRoles,
    roles: user.roles,
    overrides: user.overrides,
    resolvedFeatures,
  });
});

// ── User Override ───────────────────────────────────

app.post("/users/:userId/override", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ feature: string; granted: boolean }>();
  const user = getUser(userId);

  // 기존 override 교체 또는 추가
  const existing = user.overrides.findIndex((o) => o.feature === body.feature);
  if (existing !== -1) {
    user.overrides[existing] = { feature: body.feature, granted: body.granted };
  } else {
    user.overrides.push({ feature: body.feature, granted: body.granted });
  }

  return c.json({ ok: true, userId, overrides: user.overrides });
});

app.delete("/users/:userId/override/:feature", (c) => {
  const userId = c.req.param("userId");
  const feature = c.req.param("feature");
  const user = getUser(userId);

  const idx = user.overrides.findIndex((o) => o.feature === feature);
  if (idx !== -1) {
    user.overrides.splice(idx, 1);
  }

  return c.json({ ok: true, userId, overrides: user.overrides });
});

// ── 세션 무효화 / 재활성화 ──────────────────────────

app.post("/users/:userId/invalidate", (c) => {
  const userId = c.req.param("userId");
  const user = getUser(userId);

  user.perms_v += 1;
  user.active = false;

  return c.json({
    ok: true,
    userId,
    perms_v: user.perms_v,
    active: user.active,
  });
});

app.post("/users/:userId/activate", (c) => {
  const userId = c.req.param("userId");
  const user = getUser(userId);

  user.active = true;

  return c.json({
    ok: true,
    userId,
    perms_v: user.perms_v,
    active: user.active,
  });
});

// ── Enrichment (기존 엔드포인트, 확장) ──────────────

/**
 * Zitadel Action 또는 gateway에서 호출하는 enrichment 엔드포인트.
 *
 * 우선순위:
 * 1. Zitadel metadata에 perms가 이미 있으면 그대로 반환
 * 2. 없으면 role 기반으로 bitmask 계산 (env 제한 적용)
 */
app.post("/enrich", async (c) => {
  const body = await c.req.json<{
    userId: string;
    roles?: string[];
    env?: string;
  }>();
  const userId = body.userId;

  // 1. Zitadel metadata 우선 조회
  const zitadelPerms = await fetchZitadelMetadata(userId);
  if (zitadelPerms) {
    return c.json({
      perms: zitadelPerms.perms,
      perms_v: zitadelPerms.perms_v,
      perms_schema: zitadelPerms.perms_schema,
      source: "zitadel-metadata",
    });
  }

  // 2. 인메모리 user state에서 role 기반 계산
  const user = getUser(userId);
  const effectiveRoles = body.roles ?? user.roles;

  // 모든 role의 features를 OR 합산
  const allFeatures = new Set<FeatureName>();
  for (const role of effectiveRoles) {
    const features = resolveRoleFeatures(role);
    for (const f of features) allFeatures.add(f);
  }

  // env 제한 적용 (각 role별)
  const restricted = new Set<string>();
  if (body.env) {
    for (const role of effectiveRoles) {
      const envFeatures = applyEnvRestrictions([...allFeatures], role, body.env);
      for (const f of envFeatures) restricted.add(f);
    }
  }

  const finalFeatures = body.env
    ? [...restricted] as FeatureName[]
    : [...allFeatures];

  const bitmask = createBitmask(finalFeatures);

  return c.json({
    perms: { infra: bitmask },
    perms_v: user.perms_v,
    perms_schema: "qa-v1",
    source: "role-computed",
  });
});

// ── 레거시 호환: Role 할당 API ──────────────────────

app.put("/roles/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { role } = await c.req.json<{ role: string }>();
  if (!ROLE_DEFS[role]) return c.json({ error: "Unknown role" }, 400);
  const user = getUser(userId);
  user.roles = [role]; // 레거시 API: 단일 role 교체
  return c.json({ userId, role, ok: true });
});

app.get("/roles/:userId", (c) => {
  const userId = c.req.param("userId");
  const user = getUser(userId);
  return c.json({ userId, role: user.roles[0] ?? "viewer", roles: user.roles });
});

/** Feature 목록 + role 정의 + env 제한 */
app.get("/features", (c) => {
  return c.json({
    features: [...FEATURES],
    featureIndex: FEATURE_INDEX,
    roles: Object.fromEntries(
      Object.entries(ROLE_FEATURES).map(([role, feats]) => [role, [...feats]]),
    ),
    roleDefs: ROLE_DEFS,
    envRestrictions: ENV_RESTRICTIONS,
  });
});

/** 헬스체크 */
app.get("/health", (c) => c.json({ status: "ok", service: "enrichment" }));

// ── 서버 시작 (직접 실행 시) ─────────────────────────

const PORT = parseInt(process.env.ENRICHMENT_PORT ?? "3900");

function startServer(): void {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[enrichment] http://localhost:${PORT}`);
    if (ZITADEL_URL) {
      console.log(`[enrichment] Zitadel metadata 조회 활성: ${ZITADEL_URL}`);
    }
  });
}

// 직접 실행 감지 (tsx 또는 node)
const isDirectRun = process.argv[1]?.includes("enrichment-server");
if (isDirectRun) {
  startServer();
}

export {
  app, startServer, FEATURES, FEATURE_INDEX, ROLE_FEATURES, ROLE_DEFS,
  createBitmask, applyEnvRestrictions, ENV_RESTRICTIONS,
  hasBit, resolveRoleFeatures, checkFeature,
  users, getUser,
};
