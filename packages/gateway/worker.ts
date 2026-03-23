/**
 * QA-SDK API Gateway — CF Worker.
 *
 * 모든 외부 요청을 받아 인증 → 서비스 라우팅.
 * ADR-001: 내부 서비스는 인증을 수행하지 않는다. 게이트웨이가 일괄 처리.
 *
 * Worker-to-Worker: Service Bindings (HTTP 우회, 직접 RPC)
 * 로컬 dev: binding 없음 → URL fetch fallback
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
  /** CF Access 정책 AUD 태그 (선택 — JWT audience 검증) */
  AUTH_CF_ACCESS_AUD?: string;
  /** 허용 이메일 도메인 (쉼표 구분, 예: "mycompany.com,partner.io") */
  AUTH_ALLOWED_DOMAINS?: string;

  /** Service Bindings — Worker-to-Worker 직접 호출 */
  REGISTRY_SERVICE?: Fetcher;
  INGEST_SERVICE?: Fetcher;
  GATE_SERVICE?: Fetcher;
  QUERY_SERVICE?: Fetcher;
  DECODE_SERVICE?: Fetcher;
  DEMO_API_SERVICE?: Fetcher;

  /** Fallback URL — binding 없을 때 (로컬 dev) */
  INGEST_URL?: string;
  REGISTRY_URL?: string;
  GATE_URL?: string;
  QUERY_URL?: string;
  DECODE_URL?: string;
}

// ── 라우팅 테이블 ─────────────────────────────────

interface RouteEntry {
  prefix: string;
  /** Service Binding env key */
  bindingKey?: keyof Env;
  /** strip: prefix 제거 후 서비스에 전달 */
  strip?: boolean;
  /** fallback URL env key */
  urlKey: keyof Env;
  defaultUrl: string;
}

const ROUTES: RouteEntry[] = [
  { prefix: "/v1/ingest",    urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/v1/traces",    urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/v1/sessions",  urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/v1/scenarios", urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/v1/streams",   urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/v1/admin",     urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/v1/insights",  urlKey: "INGEST_URL",   defaultUrl: "http://localhost:3200", bindingKey: "INGEST_SERVICE" },
  { prefix: "/api/",         urlKey: "REGISTRY_URL",  defaultUrl: "http://localhost:3300", bindingKey: "REGISTRY_SERVICE" },
  { prefix: "/dev/",         urlKey: "REGISTRY_URL",  defaultUrl: "http://localhost:3300", bindingKey: "REGISTRY_SERVICE" },
  { prefix: "/catalogs",     urlKey: "REGISTRY_URL",  defaultUrl: "http://localhost:3300", bindingKey: "REGISTRY_SERVICE" },
  { prefix: "/metrics",      urlKey: "REGISTRY_URL",  defaultUrl: "http://localhost:3300", bindingKey: "REGISTRY_SERVICE" },
  { prefix: "/health/",      urlKey: "REGISTRY_URL",  defaultUrl: "http://localhost:3300", bindingKey: "REGISTRY_SERVICE" },
  { prefix: "/gate/",        urlKey: "GATE_URL",      defaultUrl: "http://localhost:3400", bindingKey: "GATE_SERVICE",    strip: true },
  { prefix: "/query/",       urlKey: "QUERY_URL",     defaultUrl: "http://localhost:3500", bindingKey: "QUERY_SERVICE",   strip: true },
  { prefix: "/state/",       urlKey: "QUERY_URL",     defaultUrl: "http://localhost:3500", bindingKey: "QUERY_SERVICE",   strip: true },
  { prefix: "/decode/",      urlKey: "DECODE_URL",    defaultUrl: "http://localhost:3600", bindingKey: "DECODE_SERVICE",  strip: true },
];

// ── 프록시 ──────────────────────────────────────────

/**
 * Service Binding 또는 HTTP fetch로 요청을 프록시한다.
 *
 * binding이 있으면 Worker 간 직접 RPC (HTTP 우회, Host 헤더 문제 없음).
 * 없으면 기존 HTTP fetch fallback (로컬 dev 등).
 */
async function proxyRequest(
  request: Request,
  url: URL,
  route: RouteEntry,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const targetPath = route.strip
    ? url.pathname.slice(route.prefix.replace(/\/$/, "").length) || "/"
    : url.pathname;

  const body = request.method !== "GET" && request.method !== "HEAD"
    ? request.body
    : undefined;

  // 1) Service Binding — Worker-to-Worker 직접 호출
  const binding = route.bindingKey ? env[route.bindingKey] as Fetcher | undefined : undefined;
  if (binding) {
    const bindingUrl = new URL(`https://internal${targetPath}${url.search}`);
    return binding.fetch(bindingUrl, {
      method: request.method,
      headers,
      body,
    });
  }

  // 2) HTTP fetch fallback
  const baseUrl = (env[route.urlKey] as string | undefined) ?? route.defaultUrl;
  const targetUrl = `${baseUrl}${targetPath}${url.search}`;
  return fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });
}

// ── Worker 엔트리 ───────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // /health — 게이트웨이 자체 헬스
    if (url.pathname === "/health") {
      const bindings = ["REGISTRY_SERVICE", "INGEST_SERVICE", "GATE_SERVICE", "QUERY_SERVICE", "DECODE_SERVICE"]
        .filter(k => !!(env as Record<string, unknown>)[k]);
      return Response.json({
        status: "ok",
        service: "gateway",
        auth: env.AUTH_MODE ?? "bypass",
        serviceBindings: bindings.length > 0 ? bindings : "none (URL fallback)",
      });
    }

    // WebSocket upgrade — /v1/ws → ingest-server로 직접 프록시
    if (url.pathname === "/v1/ws" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const binding = env.INGEST_SERVICE;
      if (binding) {
        return binding.fetch(request);
      }
      // fallback: 502 (WebSocket은 HTTP fallback 불가)
      return Response.json({ error: "WebSocket not available (no INGEST_SERVICE binding)" }, { status: 502 });
    }

    // 인증
    const authResult = authenticate(request, env);
    if (authResult instanceof Response) return authResult;

    // 라우팅
    for (const route of ROUTES) {
      if (url.pathname.startsWith(route.prefix)) {
        const headers = new Headers(request.headers);
        headers.set("X-Gateway-Identity", authResult.identity);
        headers.set("X-Gateway-Auth-Method", authResult.method);
        headers.delete("Authorization");

        try {
          return await proxyRequest(request, url, route, env, headers);
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
