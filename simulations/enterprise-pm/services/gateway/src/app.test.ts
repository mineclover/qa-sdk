// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { createApp } from "./app.js";
import { signBitmapJwt } from "./lib/jwt.js";
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

const TARGETS = {
  "sim-pm-api": "http://sim-pm-api:4500",
  "sim-approval-api": "http://sim-approval-api:4600",
  "sim-notification-api": "http://sim-notification-api:4700",
  "sim-reporting-api": "http://sim-reporting-api:4800",
  "sim-document-api": "http://sim-document-api:4900",
  "sim-audit-browser-api": "http://sim-audit-browser-api:5100",
};

afterEach(() => vi.restoreAllMocks());

describe("sim-gateway app — 통합 마운트", () => {
  it("/health 는 unprotected — 200", async () => {
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
    });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string };
    expect(body.service).toBe("sim-gateway");
  });

  it("x-request-id 헤더 부착", async () => {
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
    });
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("/auth/login 은 unprotected — JWT 없이 접근 가능 (downstream mock)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url).endsWith("/auth/authenticate"))
          return Response.json({ userId: "u" });
        if (String(url).endsWith("/bitmap/issue"))
          return Response.json({
            prefix: "sim.bitmap",
            v: "uv1",
            maskBase64: "AQ==",
            issuedAt: "2026-04-22T00:00:00Z",
            expiresAt: "2026-04-22T00:05:00Z",
            issuer: "sim-auth-api",
            signature: "s",
          });
        return new Response("nope", { status: 404 });
      }),
    );
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
    });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", password: "p" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token).toBeTruthy();
  });

  it("/projects/x — JWT 없이 401", async () => {
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
    });
    const res = await app.request("/projects/abc");
    expect(res.status).toBe(401);
  });

  it("/projects/x — 유효 JWT → downstream 호출 + 200", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("http://sim-pm-api:4500/projects/abc");
      return Response.json({ project: "abc" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = await signBitmapJwt({
      userId: "u",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
    });
    const res = await app.request("/projects/abc", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("placeholder 503 제거 회귀 — /projects/x가 더 이상 'Plan 12a will implement' 반환하지 않음", async () => {
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
    });
    const res = await app.request("/projects/x");
    if (res.status === 503) {
      const body = (await res.json()) as { message?: string };
      expect(body.message ?? "").not.toContain("Plan 12a will implement");
    }
  });
});

// spec 2026-05-02 §9 Stage 2 — sticky-consistency endpoint wiring.
import { StickyDecisionTracker } from "./routing/sticky-decision-tracker.js";
import { InMemoryRoutingStore } from "./routing/routing-table.js";

describe("app wiring — sticky-consistency endpoint", () => {
  it("internal → 200 / external → 404", async () => {
    const tracker = new StickyDecisionTracker({ maxSize: 100 });
    tracker.record("u-1", "v3", new Date());
    const app = createApp({
      authApiUrl: "http://x",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: TARGETS,
      routingStore: new InMemoryRoutingStore(),
      stickyTracker: tracker,
    });
    const ok = await app.fetch(
      new Request("http://gw/admin/routing/sticky-consistency", {
        headers: { "x-forwarded-for": "172.17.0.5" },
      }),
    );
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { sample: number }).sample).toBe(1);
    const ng = await app.fetch(
      new Request("http://gw/admin/routing/sticky-consistency", {
        headers: { "x-forwarded-for": "8.8.8.8" },
      }),
    );
    expect(ng.status).toBe(404);
  });
});
