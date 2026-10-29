/**
 * QA-SDK API Gateway — CF Worker.
 *
 * 모든 외부 요청을 받아 인증 → 서비스 라우팅.
 * ADR-001: 내부 서비스는 인증을 수행하지 않는다. 게이트웨이가 일괄 처리.
 *
 * Worker-to-Worker: Service Bindings (HTTP 우회, 직접 RPC)
 * 로컬 dev: binding 없음 → URL fetch fallback
 *
 * 라우팅: lib/route-table.ts GATEWAY_ROUTES (server.ts와 공유)
 *   /health → gateway 자체 헬스
 */

import {
  GATEWAY_ROUTES,
  GATEWAY_SERVICES,
  matchRoute,
  matchesPrefix,
  targetPath,
  type GatewayRoute,
} from './lib/route-table.js';

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
  DEFINITION_SERVICE?: Fetcher;
  DECISION_SERVICE?: Fetcher;
  DEMO_API_SERVICE?: Fetcher;

  /** Fallback URL — binding 없을 때 (로컬 dev) */
  INGEST_URL?: string;
  REGISTRY_URL?: string;
  GATE_URL?: string;
  QUERY_URL?: string;
  DECODE_URL?: string;
  DEFINITION_URL?: string;
  DECISION_URL?: string;
}

// ── 프록시 ──────────────────────────────────────────

/** route-table의 binding·URL 키로 Env 값을 읽는다 */
function envValue<T>(env: Env, key: string): T | undefined {
  return (env as unknown as Record<string, unknown>)[key] as T | undefined;
}

/**
 * Service Binding 또는 HTTP fetch로 요청을 프록시한다.
 *
 * binding이 있으면 Worker 간 직접 RPC (HTTP 우회, Host 헤더 문제 없음).
 * 없으면 기존 HTTP fetch fallback (로컬 dev 등).
 */
async function proxyRequest(
  request: Request,
  url: URL,
  route: GatewayRoute,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const target = GATEWAY_SERVICES[route.service];
  const path = targetPath(route, url.pathname);

  const body = request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined;

  // 1) Service Binding — Worker-to-Worker 직접 호출
  const binding = envValue<Fetcher>(env, target.bindingKey);
  if (binding) {
    const bindingUrl = new URL(`https://internal${path}${url.search}`);
    return binding.fetch(bindingUrl, {
      method: request.method,
      headers,
      body,
    });
  }

  // 2) HTTP fetch fallback
  const baseUrl = envValue<string>(env, target.urlEnv) ?? target.defaultUrl;
  const targetUrl = `${baseUrl}${path}${url.search}`;
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
    if (url.pathname === '/health') {
      const bindings = Object.values(GATEWAY_SERVICES)
        .map((target) => target.bindingKey)
        .filter((key) => !!envValue(env, key));
      return Response.json({
        status: 'ok',
        service: 'gateway',
        auth: env.AUTH_MODE ?? 'bypass',
        serviceBindings: bindings.length > 0 ? bindings : 'none (URL fallback)',
      });
    }

    // WebSocket upgrade — /v1/ws → ingest-server로 직접 프록시
    if (
      url.pathname === '/v1/ws' &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      const binding = env.INGEST_SERVICE;
      if (binding) {
        return binding.fetch(request);
      }
      // fallback: 502 (WebSocket은 HTTP fallback 불가)
      return Response.json(
        { error: 'WebSocket not available (no INGEST_SERVICE binding)' },
        { status: 502 },
      );
    }

    // 인증
    const authResult = authenticate(request, env);
    if (authResult instanceof Response) return authResult;

    // 라우팅
    const route = matchRoute(GATEWAY_ROUTES, url.pathname);
    if (route) {
      const headers = new Headers(request.headers);
      headers.set('X-Gateway-Identity', authResult.identity);
      headers.set('X-Gateway-Auth-Method', authResult.method);
      headers.delete('Authorization');

      try {
        return await proxyRequest(request, url, route, env, headers);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // 에러 self-report (fire-and-forget, 순환 방지: /v1/ingest 에러는 스킵)
        if (!matchesPrefix(url.pathname, '/v1/ingest') && env.INGEST_SERVICE) {
          reportProxyError(env.INGEST_SERVICE, route.prefix, message);
        }
        return Response.json(
          { error: 'Service unavailable', target: route.prefix, message },
          { status: 502 },
        );
      }
    }

    return Response.json({ error: 'Not found', path: url.pathname }, { status: 404 });
  },
};

// ── Auth ────────────────────────────────────────────

interface AuthOk {
  identity: string;
  method: string;
}

function authenticate(request: Request, env: Env): AuthOk | Response {
  const mode = env.AUTH_MODE ?? 'bypass';

  if (mode === 'bypass') {
    return { identity: 'dev', method: 'bypass' };
  }

  if (mode === 'api-key') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const key = authHeader.slice(7);
    const validKeys = (env.AUTH_API_KEYS ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (!validKeys.includes(key)) {
      return Response.json({ error: 'Invalid API key' }, { status: 403 });
    }
    return { identity: `key:${key.slice(0, 8)}`, method: 'api-key' };
  }

  if (mode === 'cf-access') {
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!jwt) {
      return Response.json({ error: 'Missing CF Access token' }, { status: 401 });
    }
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) throw new Error('bad jwt');
      const payload = JSON.parse(atob(parts[1]));
      return { identity: payload.email ?? payload.sub ?? 'cf-user', method: 'cf-access' };
    } catch {
      return Response.json({ error: 'Invalid CF Access token' }, { status: 401 });
    }
  }

  return Response.json({ error: 'Unknown auth mode' }, { status: 500 });
}

// ── Error Self-Report ─────────────────────────────

function reportProxyError(binding: Fetcher, target: string, message?: string): void {
  const now = new Date().toISOString();
  const id = `gerr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    binding
      .fetch(
        new Request('https://internal/v1/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transmission_id: id,
            sent_at: now,
            source: { service_name: 'gateway', sdk_name: 'error-reporter', sdk_version: '1.0' },
            build: { env: 'prod' },
            owner: { owner_type: 'agent', owner_id: 'error-reporter' },
            runtime: { platform: 'worker' },
            records: [
              {
                log_id: id,
                trace_id: `err-gw-${Date.now()}`,
                span_id: 'err',
                timestamp: now,
                record_kind: 'log',
                event_key: 'error.service',
                event_version: '001',
                payload_format: 'json',
                payload_encoding: 'raw',
                payload_masking_applied: false,
                payload_masked_fields: [],
                payload: {
                  service: 'gateway',
                  code: 'PROXY_ERROR',
                  message: (message ?? '').slice(0, 500),
                  target,
                },
              },
            ],
          }),
        }),
      )
      .catch(() => {});
  } catch {}
}
