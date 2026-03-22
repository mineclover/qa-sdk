/**
 * QA-SDK API Gateway — CF Worker.
 *
 * 모든 외부 요청을 받아 인증 → 서비스 라우팅.
 * ADR-001: 내부 서비스는 인증을 수행하지 않는다. 게이트웨이가 일괄 처리.
 *
 * 라우팅:
 *   /v1/ingest/*    → ingest-server
 *   /v1/traces/*    → ingest-server
 *   /v1/sessions/*  → ingest-server
 *   /api/*          → registry-service
 *   /gate/*         → gate-service
 *   /query/*        → query-service
 *   /decode/*       → decode-service
 *   /health         → gateway 자체 헬스
 */

export interface Env {
  /** 인증 모드: bypass(개발) | api-key | cf-access */
  AUTH_MODE?: string;
  /** API Key 목록 (쉼표 구분) */
  AUTH_API_KEYS?: string;
  /** CF Access 팀 도메인 */
  AUTH_CF_TEAM_DOMAIN?: string;

  /** 서비스 URL */
  INGEST_URL?: string;
  REGISTRY_URL?: string;
  GATE_URL?: string;
  QUERY_URL?: string;
  DECODE_URL?: string;
}

/** 하드코딩 fallback — registry 미연결 시 사용 */
const FALLBACK_ROUTES: Array<{ prefix: string; envKey: keyof Env; defaultUrl: string }> = [
  { prefix: "/v1/ingest", envKey: "INGEST_URL", defaultUrl: "http://localhost:3200" },
  { prefix: "/v1/traces", envKey: "INGEST_URL", defaultUrl: "http://localhost:3200" },
  { prefix: "/v1/sessions", envKey: "INGEST_URL", defaultUrl: "http://localhost:3200" },
  { prefix: "/v1/scenarios", envKey: "INGEST_URL", defaultUrl: "http://localhost:3200" },
  { prefix: "/v1/streams", envKey: "INGEST_URL", defaultUrl: "http://localhost:3200" },
  { prefix: "/v1/admin", envKey: "INGEST_URL", defaultUrl: "http://localhost:3200" },
  { prefix: "/api/", envKey: "REGISTRY_URL", defaultUrl: "http://localhost:3300" },
  { prefix: "/dev/", envKey: "REGISTRY_URL", defaultUrl: "http://localhost:3300" },
  { prefix: "/gate/", envKey: "GATE_URL", defaultUrl: "http://localhost:3400" },
  { prefix: "/query/", envKey: "QUERY_URL", defaultUrl: "http://localhost:3500" },
  { prefix: "/state/", envKey: "QUERY_URL", defaultUrl: "http://localhost:3500" },
  { prefix: "/decode/", envKey: "DECODE_URL", defaultUrl: "http://localhost:3600" },
];

/** registry에서 동적 라우팅 테이블 로드 (캐시: 60초) */
let cachedRoutes: Array<{ path: string; url: string }> | null = null;
let cacheExpiry = 0;

async function loadRoutes(env: Env): Promise<Array<{ prefix: string; url: string }>> {
  const now = Date.now();
  if (cachedRoutes && now < cacheExpiry) {
    return cachedRoutes.map(r => ({ prefix: r.path, url: r.url }));
  }

  const registryUrl = env.REGISTRY_URL ?? "http://localhost:3300";
  try {
    const resp = await fetch(`${registryUrl}/api/services/gateway?env=${env.AUTH_MODE === "bypass" ? "dev" : "prod"}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (resp.ok) {
      const data = await resp.json() as { routes: Array<{ path: string; url: string }> };
      if (data.routes.length > 0) {
        cachedRoutes = data.routes;
        cacheExpiry = now + 60_000; // 60초 캐시
        return data.routes.map(r => ({ prefix: r.path, url: r.url }));
      }
    }
  } catch { /* registry 미연결 → fallback */ }

  // fallback: 환경변수 + 하드코딩
  return FALLBACK_ROUTES.map(r => ({
    prefix: r.prefix,
    url: env[r.envKey] ?? r.defaultUrl,
  }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // /health — 게이트웨이 자체 헬스
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "gateway", auth: env.AUTH_MODE ?? "bypass" });
    }

    // 인증
    const authResult = authenticate(request, env);
    if (authResult instanceof Response) return authResult;

    // 서비스 라우팅 (registry 동적 → fallback)
    const routes = await loadRoutes(env);
    for (const route of routes) {
      if (url.pathname.startsWith(route.prefix)) {
        const targetUrl = `${route.url}${url.pathname}${url.search}`;

        const headers = new Headers(request.headers);
        headers.set("X-Gateway-Identity", authResult.identity);
        headers.set("X-Gateway-Auth-Method", authResult.method);
        headers.delete("Authorization"); // 내부 서비스에 인증 헤더 전달 안 함 (ADR-001)

        try {
          return await fetch(targetUrl, {
            method: request.method,
            headers,
            body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
          });
        } catch (err: any) {
          return Response.json(
            { error: "Service unavailable", target: route.prefix, message: err?.message },
            { status: 502 },
          );
        }
      }
    }

    return Response.json({ error: "Not found", path: url.pathname }, { status: 404 });
  },
};

// ── Auth ────────────────────────────────────────────

interface AuthOk {
  identity: string;
  method: string;
}

function authenticate(request: Request, env: Env): AuthOk | Response {
  const mode = env.AUTH_MODE ?? "bypass";

  if (mode === "bypass") {
    return { identity: "dev", method: "bypass" };
  }

  if (mode === "api-key") {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Missing Authorization header" }, { status: 401 });
    }
    const key = authHeader.slice(7);
    const validKeys = (env.AUTH_API_KEYS ?? "").split(",").map(k => k.trim()).filter(Boolean);
    if (!validKeys.includes(key)) {
      return Response.json({ error: "Invalid API key" }, { status: 403 });
    }
    return { identity: `key:${key.slice(0, 8)}`, method: "api-key" };
  }

  if (mode === "cf-access") {
    const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt) {
      return Response.json({ error: "Missing CF Access token" }, { status: 401 });
    }
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("bad jwt");
      const payload = JSON.parse(atob(parts[1]));
      return { identity: payload.email ?? payload.sub ?? "cf-user", method: "cf-access" };
    } catch {
      return Response.json({ error: "Invalid CF Access token" }, { status: 401 });
    }
  }

  return Response.json({ error: "Unknown auth mode" }, { status: 500 });
}
