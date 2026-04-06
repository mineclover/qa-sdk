/**
 * Permission Enrichment Server.
 *
 * Zitadel Action에서 호출하거나, gateway에서 직접 호출하여
 * 사용자의 role에 따른 bitmask permission claims를 반환한다.
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

// ── 인메모리 사용자 Role 저장소 (간이) ────────────────

const USER_ROLES: Record<string, string> = {};

// ── Routes ───────────────────────────────────────────

/** Zitadel Action 또는 gateway에서 호출하는 enrichment 엔드포인트 */
app.post("/enrich", async (c) => {
  const body = await c.req.json<{ userId: string; roles?: string[] }>();
  const userId = body.userId;

  // role 결정: 요청에 전달된 roles 또는 내부 저장소, 기본값 viewer
  const role = body.roles?.[0] ?? USER_ROLES[userId] ?? "viewer";
  const features = ROLE_FEATURES[role] ?? ROLE_FEATURES["viewer"]!;
  const bitmask = createBitmask(features);

  return c.json({
    perms: { infra: bitmask },
    perms_v: 1,
    perms_schema: "qa-v1",
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

/** Feature 목록 + role 정의 */
app.get("/features", (c) => {
  return c.json({
    features: [...FEATURES],
    featureIndex: FEATURE_INDEX,
    roles: Object.fromEntries(
      Object.entries(ROLE_FEATURES).map(([role, feats]) => [role, [...feats]]),
    ),
  });
});

/** 헬스체크 */
app.get("/health", (c) => c.json({ status: "ok", service: "enrichment" }));

// ── 서버 시작 (직접 실행 시) ─────────────────────────

const PORT = parseInt(process.env.ENRICHMENT_PORT ?? "3900");

function startServer(): void {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[enrichment] http://localhost:${PORT}`);
  });
}

// 직접 실행 감지 (tsx 또는 node)
const isDirectRun = process.argv[1]?.includes("enrichment-server");
if (isDirectRun) {
  startServer();
}

export { app, startServer, FEATURES, FEATURE_INDEX, ROLE_FEATURES, createBitmask };
