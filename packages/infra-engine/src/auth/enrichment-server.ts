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
 *
 * 현재는 간이 매핑. 실제로는 permission-engine의 RoleRegistry +
 * UserPermissionEngine으로 교체 예정.
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
] as const;

type FeatureName = typeof FEATURES[number];

/** feature 이름 -> 비트 인덱스 */
const FEATURE_INDEX = Object.fromEntries(
  FEATURES.map((f, i) => [f, i]),
) as Record<FeatureName, number>;

// ── Role -> Feature 매핑 ─────────────────────────────

const ROLE_FEATURES: Record<string, readonly FeatureName[]> = {
  admin: FEATURES, // 전체
  operator: [
    "ingest_read", "ingest_write", "registry_read", "gate_read",
    "query_read", "decode_read", "definition_read", "decision_read",
    "deploy_execute", "monitoring_read",
  ],
  viewer: [
    "ingest_read", "registry_read", "gate_read", "query_read",
    "decode_read", "definition_read", "decision_read", "monitoring_read",
  ],
};

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
    // prod에서는 admin만 deploy 가능 — operator/viewer에서 deploy 차단
    operator: ["deploy_execute"],
    viewer: ["deploy_execute", "ingest_write", "definition_write", "decision_write"],
  },
  staging: {
    // staging에서는 viewer의 write 차단
    viewer: ["ingest_write", "definition_write", "decision_write"],
  },
  dev: {
    // 개발 환경: 제한 없음
  },
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
export function hasBit(bitmaskB64: string, featureName: string): boolean {
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

// ── 인메모리 사용자 Role 저장소 (간이) ────────────────

const USER_ROLES: Record<string, string> = {};

// ── Routes ───────────────────────────────────────────

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

  // 2. role 기반 계산 (env 제한 적용)
  const role = body.roles?.[0] ?? USER_ROLES[userId] ?? "viewer";
  const baseFeatures = ROLE_FEATURES[role] ?? ROLE_FEATURES["viewer"]!;
  const features = applyEnvRestrictions(baseFeatures, role, body.env);
  const bitmask = createBitmask(features);

  return c.json({
    perms: { infra: bitmask },
    perms_v: 1,
    perms_schema: "qa-v1",
    source: "role-computed",
  });
});

/** Role 할당 API */
app.put("/roles/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { role } = await c.req.json<{ role: string }>();
  if (!ROLE_FEATURES[role]) return c.json({ error: "Unknown role" }, 400);
  USER_ROLES[userId] = role;
  return c.json({ userId, role, ok: true });
});

/** Role 조회 */
app.get("/roles/:userId", (c) => {
  const userId = c.req.param("userId");
  return c.json({ userId, role: USER_ROLES[userId] ?? "viewer" });
});

/** Feature 목록 + role 정의 + env 제한 */
app.get("/features", (c) => {
  return c.json({
    features: [...FEATURES],
    featureIndex: FEATURE_INDEX,
    roles: Object.fromEntries(
      Object.entries(ROLE_FEATURES).map(([role, feats]) => [role, [...feats]]),
    ),
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
  app, startServer, FEATURES, FEATURE_INDEX, ROLE_FEATURES,
  createBitmask, applyEnvRestrictions, ENV_RESTRICTIONS,
};
