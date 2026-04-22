// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { createProxyRoutes, PROXY_TARGETS } from "./proxy-routes.js";
import { jwtVerifyMiddleware } from "../middleware/jwt-verify.js";
import { signBitmapJwt } from "../lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

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

afterEach(() => vi.restoreAllMocks());

function makeAuthedApp(targets: Record<string, string>) {
  const app = new Hono();
  for (const { path } of PROXY_TARGETS) {
    app.use(
      `${path}/*`,
      jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }),
    );
    app.use(path, jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  }
  app.route("/", createProxyRoutes({ targets, timeoutMs: 5000 }));
  return app;
}

const ALL_TARGETS = {
  "sim-pm-api": "http://sim-pm-api:4500",
  "sim-approval-api": "http://sim-approval-api:4600",
  "sim-notification-api": "http://sim-notification-api:4700",
  "sim-reporting-api": "http://sim-reporting-api:4800",
  "sim-document-api": "http://sim-document-api:4900",
  "sim-audit-browser-api": "http://sim-audit-browser-api:5100",
};

describe("createProxyRoutes — 6 service reverse proxy", () => {
  it("PROXY_TARGETS 표 — 6 서비스", () => {
    expect(PROXY_TARGETS.map((t) => t.path)).toEqual([
      "/projects",
      "/approvals",
      "/notifications",
      "/reports",
      "/documents",
      "/audit",
    ]);
  });

  it("/projects/123 → sim-pm-api로 proxy + downstream에 x-auth-user-id", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://sim-pm-api:4500/projects/123");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-auth-user-id")).toBe("user-42");
      expect(headers.get("x-auth-bitmap-v")).toBe("uv1");
      return Response.json({ project: "p123" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await signBitmapJwt({
      userId: "user-42",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/projects/123", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { project: string };
    expect(body.project).toBe("p123");
  });

  it("JWT 누락 → 401 (proxy 호출 없음)", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/projects/x");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("6 서비스 모두 정상 라우팅 (smoke)", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        calls.push(String(url));
        return Response.json({ ok: true });
      }),
    );
    const token = await signBitmapJwt({
      userId: "u",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeAuthedApp(ALL_TARGETS);
    for (const [path, expectedTarget] of [
      ["/projects/x", "http://sim-pm-api:4500/projects/x"],
      ["/approvals/y", "http://sim-approval-api:4600/approvals/y"],
      ["/notifications/z", "http://sim-notification-api:4700/notifications/z"],
      ["/reports/q", "http://sim-reporting-api:4800/reports/q"],
      ["/documents/d", "http://sim-document-api:4900/documents/d"],
      ["/audit/a", "http://sim-audit-browser-api:5100/audit/a"],
    ] as const) {
      const res = await app.request(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(calls).toContain(expectedTarget);
    }
  });

  it("target URL 누락 시 createProxyRoutes가 throw", () => {
    expect(() =>
      createProxyRoutes({
        targets: { "sim-pm-api": "http://x" }, // 나머지 누락
        timeoutMs: 5000,
      }),
    ).toThrow(/URL missing/);
  });
});
