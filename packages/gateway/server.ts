/**
 * Gateway Server — Node.js 실행 모드.
 *
 * Tailscale VPN 환경에서 사용:
 * - Tailscale IP로만 접근 가능 (100.x.x.x)
 * - 또는 Tailscale Funnel로 외부 노출
 *
 * CF Worker와 동일한 라우팅 로직 사용.
 *
 * 실행: node --loader tsx gateway/server.ts
 * 환경변수: AUTH_MODE, REGISTRY_URL, INGEST_URL 등
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// ── 환경변수 ────────────────────────────────────────

const AUTH_MODE = process.env.AUTH_MODE ?? "bypass";
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:3300";
const PORT = parseInt(process.env.GATEWAY_PORT ?? "8787");

const SERVICE_URLS: Record<string, string> = {
  ingest: process.env.INGEST_URL ?? "http://localhost:3200",
  registry: process.env.REGISTRY_URL ?? "http://localhost:3300",
  gate: process.env.GATE_URL ?? "http://localhost:3400",
  query: process.env.QUERY_URL ?? "http://localhost:3500",
  decode: process.env.DECODE_URL ?? "http://localhost:3600",
};

const PATH_MAP: Array<{ prefix: string; service: string; strip?: boolean }> = [
  { prefix: "/v1/ingest", service: "ingest" },
  { prefix: "/v1/traces", service: "ingest" },
  { prefix: "/v1/sessions", service: "ingest" },
  { prefix: "/v1/scenarios", service: "ingest" },
  { prefix: "/v1/streams", service: "ingest" },
  { prefix: "/v1/admin", service: "ingest" },
  { prefix: "/api/", service: "registry" },
  { prefix: "/dev/", service: "registry" },
  { prefix: "/catalogs", service: "registry" },
  { prefix: "/health/generation", service: "registry" },
  { prefix: "/metrics", service: "registry", strip: true },
  { prefix: "/gate/", service: "gate", strip: true },
  { prefix: "/query/", service: "query", strip: true },
  { prefix: "/state/", service: "query", strip: true },
  { prefix: "/decode/", service: "decode", strip: true },
];

// ── 동적 라우팅 (registry 기반) ─────────────────────

interface GatewayRoute {
  prefix: string;
  url: string;
  strip: boolean;
}

let dynamicRoutes: GatewayRoute[] | null = null;
let routesCacheExpiry = 0;

async function getRoutes(): Promise<GatewayRoute[]> {
  const now = Date.now();
  if (dynamicRoutes && now < routesCacheExpiry) return dynamicRoutes;

  try {
    const env = AUTH_MODE === "bypass" ? "dev" : "prod";
    const resp = await fetch(`${REGISTRY_URL}/api/services/gateway?env=${env}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (resp.ok) {
      const data = await resp.json() as { routes: Array<{ path: string; url: string; strip?: boolean }> };
      if (data.routes.length > 0) {
        dynamicRoutes = data.routes.map(r => ({ prefix: r.path, url: r.url, strip: r.strip ?? false }));
        routesCacheExpiry = now + 60_000;
        return dynamicRoutes;
      }
    }
  } catch { /* fallback */ }

  return PATH_MAP.map(r => ({ prefix: r.prefix, url: SERVICE_URLS[r.service], strip: r.strip ?? false }));
}

// ── 미들웨어 ────────────────────────────────────────

app.use("*", cors({ origin: "*" }));

// ── 인증 ────────────────────────────────────────────

app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/health") return next();

  if (AUTH_MODE === "bypass") {
    c.set("identity", "dev");
    return next();
  }

  if (AUTH_MODE === "api-key") {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
    const keys = (process.env.AUTH_API_KEYS ?? "").split(",").map(k => k.trim());
    if (!keys.includes(auth.slice(7))) return c.json({ error: "Forbidden" }, 403);
    c.set("identity", `key:${auth.slice(7, 15)}`);
    return next();
  }

  // tailscale 모드: Tailscale-User-Login 헤더 확인 (tailscale serve가 주입)
  if (AUTH_MODE === "tailscale") {
    const tsUser = c.req.header("Tailscale-User-Login");
    const tsName = c.req.header("Tailscale-User-Name");
    if (!tsUser) return c.json({ error: "Tailscale auth required" }, 401);
    c.set("identity", tsUser);
    return next();
  }

  return c.json({ error: "Unknown auth mode" }, 500);
});

// ── 헬스체크 ────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "gateway",
    auth: AUTH_MODE,
    mode: "node",
  });
});

// ── 프록시 ──────────────────────────────────────────

app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const routes = await getRoutes();

  for (const route of routes) {
    if (url.pathname.startsWith(route.prefix)) {
      const targetPath = route.strip
        ? url.pathname.slice(route.prefix.replace(/\/$/, "").length) || "/"
        : url.pathname;
      const targetUrl = `${route.url}${targetPath}${url.search}`;
      const headers = new Headers(c.req.raw.headers);
      headers.set("X-Gateway-Identity", c.get("identity") ?? "unknown");
      headers.delete("Authorization");

      // body: arrayBuffer로 읽어서 전달 (stream 소비 문제 방지)
      let body: ArrayBuffer | undefined;
      if (c.req.method !== "GET" && c.req.method !== "HEAD") {
        try { body = await c.req.arrayBuffer(); } catch { /* empty body */ }
      }

      try {
        const resp = await fetch(targetUrl, {
          method: c.req.method,
          headers,
          body,
        });
        return new Response(resp.body, {
          status: resp.status,
          headers: resp.headers,
        });
      } catch (err: any) {
        return c.json({ error: "Service unavailable", message: err?.message }, 502);
      }
    }
  }

  return c.json({ error: "Not found", path: url.pathname }, 404);
});

// ── 서버 시작 ───────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[gateway] http://localhost:${info.port} (auth: ${AUTH_MODE})`);
  console.log(`[gateway] Tailscale: tailscale serve --bg ${info.port}`);
});
