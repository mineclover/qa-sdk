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
  for (const target of PROXY_TARGETS) {
    const kind = target.kind ?? "prefix";
    if (kind === "exact") {
      app.use(
        target.path,
        jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }),
      );
    } else {
      app.use(
        `${target.path}/*`,
        jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }),
      );
      app.use(
        target.path,
        jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }),
      );
    }
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
  it("PROXY_TARGETS 표 — 기존 6 서비스 prefix 유지", () => {
    const paths = PROXY_TARGETS.map((t) => t.path);
    // 회귀 방지: 원 6 prefix 가 모두 존재해야 한다.
    for (const p of [
      "/projects",
      "/approvals",
      "/notifications",
      "/reports",
      "/documents",
      "/audit",
    ]) {
      expect(paths).toContain(p);
    }
  });

  it("PROXY_TARGETS 표 — 추가된 일반 슬라이스 (12 entries)", () => {
    const paths = PROXY_TARGETS.map((t) => t.path);
    // pm-api
    expect(paths).toContain("/tasks");
    expect(paths).toContain("/assignments");
    expect(paths).toContain("/members");
    expect(paths).toContain("/users/:userId/projects");
    // approval-api
    expect(paths).toContain("/expense-reports");
    expect(paths).toContain("/resource-requests");
    expect(paths).toContain("/time-off-requests");
    // notification-api
    expect(paths).toContain("/subscriptions");
    expect(paths).toContain("/users/:userId/notifications");
    expect(paths).toContain("/users/:userId/subscriptions");
    // reporting-api
    expect(paths).toContain("/metrics");
    expect(paths).toContain("/density");
  });

  it("PROXY_TARGETS 표 — BFF 엔트리 (옵션 A: slice 별 path, 7 entries)", () => {
    const paths = PROXY_TARGETS.map((t) => t.path);
    expect(paths).toContain("/bff/assignments");
    expect(paths).toContain("/bff/budget-requests");
    expect(paths).toContain("/bff/expense-reports");
    expect(paths).toContain("/bff/resource-requests");
    expect(paths).toContain("/bff/time-off-requests");
    expect(paths).toContain("/bff/notifications");
    expect(paths).toContain("/bff/subscriptions");
  });

  it("PROXY_TARGETS — `/users/:userId/*` 충돌 해소 (kind=exact)", () => {
    // pm-api 와 notification-api 가 `/users/:userId` 를 공유하지만 leaf path 가
    // 다르므로 specific exact 패턴으로 분리되어야 한다.
    const userScopedTargets = PROXY_TARGETS.filter((t) =>
      t.path.startsWith("/users/:userId"),
    );
    expect(userScopedTargets.length).toBe(3);
    for (const t of userScopedTargets) {
      expect(t.kind).toBe("exact");
    }
    const byPath = Object.fromEntries(
      userScopedTargets.map((t) => [t.path, t.serviceKey]),
    );
    expect(byPath["/users/:userId/projects"]).toBe("sim-pm-api");
    expect(byPath["/users/:userId/notifications"]).toBe(
      "sim-notification-api",
    );
    expect(byPath["/users/:userId/subscriptions"]).toBe(
      "sim-notification-api",
    );
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

  it("추가 슬라이스 라우팅 smoke — pm/approval/notification/reporting", async () => {
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
      // pm-api
      ["/tasks/t-1", "http://sim-pm-api:4500/tasks/t-1"],
      ["/assignments/a-1", "http://sim-pm-api:4500/assignments/a-1"],
      ["/members", "http://sim-pm-api:4500/members"],
      // approval-api
      ["/expense-reports/e-1", "http://sim-approval-api:4600/expense-reports/e-1"],
      ["/resource-requests/r-1", "http://sim-approval-api:4600/resource-requests/r-1"],
      ["/time-off-requests/t-1", "http://sim-approval-api:4600/time-off-requests/t-1"],
      // notification-api
      ["/subscriptions/s-1", "http://sim-notification-api:4700/subscriptions/s-1"],
      // reporting-api
      ["/metrics/keys", "http://sim-reporting-api:4800/metrics/keys"],
      ["/density/x", "http://sim-reporting-api:4800/density/x"],
    ] as const) {
      const res = await app.request(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(calls).toContain(expectedTarget);
    }
  });

  it("`/users/:userId/projects` → sim-pm-api (path-param exact)", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "http://sim-pm-api:4500/users/user-42/projects",
      );
      return Response.json({ projects: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = await signBitmapJwt({
      userId: "user-42",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/users/user-42/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("`/users/:userId/notifications` → sim-notification-api (path-param exact, 충돌 해소)", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "http://sim-notification-api:4700/users/user-42/notifications",
      );
      return Response.json({ notifications: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = await signBitmapJwt({
      userId: "user-42",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/users/user-42/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("`/users/:userId/subscriptions` → sim-notification-api (path-param exact)", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "http://sim-notification-api:4700/users/user-42/subscriptions",
      );
      return Response.json({ subscriptions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = await signBitmapJwt({
      userId: "user-42",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/users/user-42/subscriptions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("BFF 라우팅 smoke — 7 resource 가 올바른 서비스로", async () => {
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
      ["/bff/assignments/a-1", "http://sim-pm-api:4500/bff/assignments/a-1"],
      [
        "/bff/budget-requests/b-1",
        "http://sim-approval-api:4600/bff/budget-requests/b-1",
      ],
      [
        "/bff/expense-reports/e-1",
        "http://sim-approval-api:4600/bff/expense-reports/e-1",
      ],
      [
        "/bff/resource-requests/r-1",
        "http://sim-approval-api:4600/bff/resource-requests/r-1",
      ],
      [
        "/bff/time-off-requests/t-1",
        "http://sim-approval-api:4600/bff/time-off-requests/t-1",
      ],
      [
        "/bff/notifications/n-1",
        "http://sim-notification-api:4700/bff/notifications/n-1",
      ],
      [
        "/bff/subscriptions/s-1",
        "http://sim-notification-api:4700/bff/subscriptions/s-1",
      ],
    ] as const) {
      const res = await app.request(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(calls).toContain(expectedTarget);
    }
  });

  it("`/bff/notifications/:id` JWT 누락 시 401 (보호 회귀)", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/bff/notifications/n-1");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("`/users/:userId/notifications` JWT 누락 시 401", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const app = makeAuthedApp(ALL_TARGETS);
    const res = await app.request("/users/u-1/notifications");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
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
