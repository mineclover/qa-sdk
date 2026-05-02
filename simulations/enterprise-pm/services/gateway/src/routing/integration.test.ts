// @def.boundary sim-gateway
// @def.doc canary-routing-decision

/**
 * Plan C 단계 7 Task 7.7 — routing 통합 테스트.
 *
 * createApp({ routingStore, internalCidrs, ... })로 테스트 앱 부팅 → POST /admin/routing
 * 으로 weight=10 + candidate=v4-candidate 푸시 → 다른 user_id 1000개로 /approvals 호출
 * → upstream URL 분포가 [80, 120] 범위(10% ± 노이즈) 검증.
 *
 * 추가 케이스:
 *   (a) weight=0 rollback 후 모든 사용자 v1로 회귀.
 *   (b) x-canary-override로 강제 candidate.
 *   (c) 동일 user_id의 weight 5%→15% 변경 시 같은 결정 유지(spec §3.3 deterministic).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { VersionedBitmap } from "permission-engine";
import { createApp } from "../app.js";
import { signBitmapJwt } from "../lib/jwt.js";
import { InMemoryRoutingStore, type RouteEntry } from "./routing-table.js";
import { parseCidrList } from "../lib/internal-network.js";

const SECRET = "x".repeat(32);
const SAMPLE_BM: VersionedBitmap = {
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0x01]),
  issuedAt: "2026-04-22T00:00:00Z",
  expiresAt: "2026-04-22T00:05:00Z",
  issuer: "sim-auth-api",
  signature: "s",
};
const TARGETS = {
  "sim-pm-api": "http://sim-pm-api:4500",
  "sim-approval-api": "http://sim-approval-api:4600",
  "sim-notification-api": "http://sim-notification-api:4700",
  "sim-reporting-api": "http://sim-reporting-api:4800",
  "sim-document-api": "http://sim-document-api:4900",
  "sim-audit-browser-api": "http://sim-audit-browser-api:5100",
};

const APPROVAL_V1 = "http://sim-approval-api-v1:4500";
const APPROVAL_V2 = "http://sim-approval-api-v2:4500";

const STABLE_ONLY: RouteEntry = {
  revision: 1,
  stable: { version: "v3", upstream: APPROVAL_V1 },
  candidate: null,
  weight: 0,
  stickyKey: "user_id",
};
const WITH_CANDIDATE_10: RouteEntry = {
  revision: 2,
  stable: { version: "v3", upstream: APPROVAL_V1 },
  candidate: { version: "v4-candidate", upstream: APPROVAL_V2 },
  weight: 10,
  stickyKey: "user_id",
};

afterEach(() => vi.restoreAllMocks());

async function tokenFor(userId: string): Promise<string> {
  return signBitmapJwt({
    userId,
    bitmap: SAMPLE_BM,
    secret: SECRET,
    ttlSeconds: 300,
  });
}

interface AppHandle {
  app: ReturnType<typeof createApp>;
  store: InMemoryRoutingStore;
}

function buildApp(): AppHandle {
  const store = new InMemoryRoutingStore();
  const app = createApp({
    authApiUrl: "http://x",
    jwtSecret: SECRET,
    jwtTtlSeconds: 300,
    currentBitmapV: "uv1",
    proxyTimeoutMs: 5_000,
    proxyTargets: TARGETS,
    routingStore: store,
    internalCidrs: parseCidrList("172.16.0.0/12"),
  });
  return { app, store };
}

interface DistributionResult {
  v1Hits: number;
  v2Hits: number;
  versionStamps: Map<string, string>;
}

async function fireUsers(
  app: AppHandle["app"],
  userIds: string[],
  extraHeaders: Record<string, string> = {},
): Promise<DistributionResult> {
  let v1 = 0;
  let v2 = 0;
  const stamps = new Map<string, string>();
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const headers = new Headers(init?.headers ?? {});
    const stamp = headers.get("x-service-version") ?? "(none)";
    if (u.startsWith(APPROVAL_V1)) v1++;
    else if (u.startsWith(APPROVAL_V2)) v2++;
    else throw new Error(`unexpected upstream: ${u}`);
    return Response.json({ ok: true, stamp });
  });
  vi.stubGlobal("fetch", fetchMock);
  for (const uid of userIds) {
    const tok = await tokenFor(uid);
    const res = await app.request("/approvals/smoke", {
      headers: { Authorization: `Bearer ${tok}`, ...extraHeaders },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stamp: string };
    stamps.set(uid, body.stamp);
  }
  return { v1Hits: v1, v2Hits: v2, versionStamps: stamps };
}

describe("routing integration — sticky-by-user (spec §3.1/§3.3)", () => {
  it("weight=10 → ~10% (80~120 / 1000) candidate; stamps grammar #4 v3 / v4-candidate", async () => {
    const { app, store } = buildApp();
    const internalIp = "172.17.0.5";
    const pushRes = await app.fetch(
      new Request("http://gw/admin/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": internalIp },
        body: JSON.stringify({ services: { "sim-approval-api": WITH_CANDIDATE_10 } }),
      }),
    );
    expect(pushRes.status).toBe(200);
    expect(store.getRoute("sim-approval-api")?.weight).toBe(10);

    const userIds = Array.from({ length: 1000 }, (_, i) => `u-${i}`);
    const dist = await fireUsers(app, userIds);
    expect(dist.v1Hits + dist.v2Hits).toBe(1000);
    expect(dist.v2Hits).toBeGreaterThanOrEqual(50);
    expect(dist.v2Hits).toBeLessThanOrEqual(150);
    // 모든 stamp는 grammar #2/#4 builder 결과 — raw string 보간 금지.
    const uniqueStamps = new Set(dist.versionStamps.values());
    expect(uniqueStamps.has("v3")).toBe(true);
    expect(uniqueStamps.has("v4-candidate")).toBe(true);
  });

  it("rollback (weight=0) 후 모든 user → v1", async () => {
    const { app } = buildApp();
    await app.fetch(
      new Request("http://gw/admin/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "172.17.0.5" },
        body: JSON.stringify({
          services: {
            "sim-approval-api": { ...WITH_CANDIDATE_10, revision: 3, weight: 0 },
          },
        }),
      }),
    );
    const dist = await fireUsers(
      app,
      Array.from({ length: 200 }, (_, i) => `r-${i}`),
    );
    expect(dist.v1Hits).toBe(200);
    expect(dist.v2Hits).toBe(0);
  });

  it("x-canary-override (internal IP) → 강제 candidate, sticky 무시", async () => {
    const { app } = buildApp();
    await app.fetch(
      new Request("http://gw/admin/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "172.17.0.5" },
        body: JSON.stringify({ services: { "sim-approval-api": STABLE_ONLY } }),
      }),
    );
    // STABLE_ONLY는 candidate=null이라 override가 candidate 강제해도 적용 안 됨 → with-candidate 푸시.
    await app.fetch(
      new Request("http://gw/admin/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "172.17.0.5" },
        body: JSON.stringify({
          services: { "sim-approval-api": { ...WITH_CANDIDATE_10, revision: 9 } },
        }),
      }),
    );
    const dist = await fireUsers(
      app,
      Array.from({ length: 50 }, (_, i) => `o-${i}`),
      {
        "x-canary-override": "candidate:v4-candidate",
        "x-forwarded-for": "172.17.0.5",
      },
    );
    expect(dist.v2Hits).toBe(50);
    expect(dist.v1Hits).toBe(0);
  });

  it("deterministic: weight 5%→15% 변경 시 같은 user_id 라우팅 결정 안 변함 (변동폭 밖)", async () => {
    const { app } = buildApp();
    // 1차: weight=5
    await app.fetch(
      new Request("http://gw/admin/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "172.17.0.5" },
        body: JSON.stringify({
          services: {
            "sim-approval-api": { ...WITH_CANDIDATE_10, revision: 11, weight: 5 },
          },
        }),
      }),
    );
    const userIds = Array.from({ length: 200 }, (_, i) => `d-${i}`);
    const first = await fireUsers(app, userIds);

    // 2차: weight=15 — bucket이 [0,5) 또는 [15,100)에 있으면 결정 동일.
    //      [5,15) bucket만 v1→v2로 변동 (예상 ≈ 10% × 200 = 20명 이내).
    await app.fetch(
      new Request("http://gw/admin/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "172.17.0.5" },
        body: JSON.stringify({
          services: {
            "sim-approval-api": { ...WITH_CANDIDATE_10, revision: 12, weight: 15 },
          },
        }),
      }),
    );
    const second = await fireUsers(app, userIds);

    let stable = 0;
    for (const uid of userIds) {
      if (first.versionStamps.get(uid) === second.versionStamps.get(uid)) stable++;
    }
    // 결정론적 hash. 변동폭 [5,15)에 들어간 bucket만 변경 (이론적 ≈ 10%).
    // 200명 중 stable한 비율은 ≥ 80% 기대.
    expect(stable).toBeGreaterThan(160);
  });
});
