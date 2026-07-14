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

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { JwksVerifier } from './lib/jwks-verifier.js';
import { getRoutePermission, checkPermission } from './lib/route-permissions.js';

const app = new Hono();

// ── 환경변수 ────────────────────────────────────────

const AUTH_MODE = process.env.AUTH_MODE ?? 'bypass';
const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:3300';
const PORT = parseInt(process.env.PORT ?? '8787');
const GATEWAY_ENV = process.env.GATEWAY_ENV ?? 'dev'; // dev | staging | prod — ScopedEngine env 분리

// ── JWKS 검증기 ────────────────────────────────────────

const JWKS_URL = process.env.JWKS_URL; // e.g., "http://localhost:8085/oauth/v2/keys"
const JWKS_VERIFIER = JWKS_URL ? new JwksVerifier(JWKS_URL) : null;
if (JWKS_VERIFIER) {
  console.log(`[gateway] JWKS 서명 검증 활성: ${JWKS_URL}`);
} else {
  console.log(`[gateway] JWKS 미설정 — JWT 서명 미검증 (개발 모드)`);
}

// ── Enrichment JWT (HS256) 검증 ─────────────────────────
// Zitadel Action의 metadata 주입이 불안정하므로,
// enrichment 서버가 발급한 HS256 JWT도 검증한다.

const ENRICHMENT_JWT_SECRET = process.env.ENRICHMENT_JWT_SECRET;
if (ENRICHMENT_JWT_SECRET) {
  console.log(`[gateway] Enrichment JWT (HS256) 검증 활성`);
}

/**
 * HS256 JWT 서명 검증.
 * enrichment 서버가 발급한 JWT를 gateway에서 검증한다.
 * 성공 시 payload 반환, 실패 시 null.
 */
async function verifyHS256(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as Record<
      string,
      unknown
    >;
    if (header.alg !== 'HS256') return null;

    const { createHmac } = await import('node:crypto');
    const expected = createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');

    if (parts[2] !== expected) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<
      string,
      unknown
    >;

    // 만료 체크
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ── Zitadel Metadata / Enrichment Fallback ────────────

const ZITADEL_URL = process.env.ZITADEL_URL; // e.g., "http://localhost:8085"
const ZITADEL_SERVICE_TOKEN = process.env.ZITADEL_SERVICE_TOKEN; // admin PAT for metadata API
const ENRICHMENT_URL = process.env.ENRICHMENT_URL; // e.g., "http://localhost:3900"

interface PermsResult {
  perms: unknown;
  perms_v: number;
  perms_schema: string;
}

/**
 * id_token에 perms가 없을 때 Zitadel user metadata 또는
 * enrichment 서버에서 permission claims를 가져온다.
 *
 * 시도 순서:
 * 1. enrichment 서버 (/enrich) — 역할 기반 실시간 계산
 * 2. Zitadel metadata API — 사전 저장된 값 조회
 *
 * 둘 다 실패하면 null 반환 (fail-open: 호출자가 403 결정).
 */
async function fetchPermsFromZitadel(userId: string): Promise<PermsResult | null> {
  // 1. enrichment 서버 시도 (env 정보 전달 — ScopedEngine env 제한 적용)
  if (ENRICHMENT_URL) {
    try {
      const resp = await fetch(`${ENRICHMENT_URL}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          env: GATEWAY_ENV,
        }),
        signal: AbortSignal.timeout(3_000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as PermsResult;
        if (data.perms) return data;
      }
    } catch {
      /* enrichment 서버 미실행 — metadata fallback */
    }
  }

  // 2. Zitadel metadata fallback
  if (ZITADEL_URL && ZITADEL_SERVICE_TOKEN && userId) {
    try {
      const metaResp = await fetch(
        `${ZITADEL_URL}/management/v1/users/${userId}/metadata/_search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ZITADEL_SERVICE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(3_000),
        },
      );
      if (metaResp.ok) {
        const meta = (await metaResp.json()) as {
          result?: Array<{ key: string; value: string }>;
        };
        let perms: unknown = undefined;
        let perms_v = 1;
        let perms_schema = 'qa-v1';
        for (const m of meta.result ?? []) {
          const val = Buffer.from(m.value, 'base64').toString();
          if (m.key === 'perms') perms = JSON.parse(val);
          if (m.key === 'perms_v') perms_v = parseInt(val) || 1;
          if (m.key === 'perms_schema') perms_schema = val;
        }
        if (perms) return { perms, perms_v, perms_schema };
      }
    } catch {
      /* metadata 조회 실패 */
    }
  }

  return null;
}

const SERVICE_URLS: Record<string, string> = {
  ingest: process.env.INGEST_URL ?? 'http://localhost:3200',
  registry: process.env.REGISTRY_URL ?? 'http://localhost:3300',
  gate: process.env.GATE_URL ?? 'http://localhost:3400',
  query: process.env.QUERY_URL ?? 'http://localhost:3500',
  decode: process.env.DECODE_URL ?? 'http://localhost:3600',
  definition: process.env.DEFINITION_URL ?? 'http://localhost:3700',
  decision: process.env.DECISION_URL ?? 'http://localhost:3800',
};

const PATH_MAP: Array<{ prefix: string; service: string; strip?: boolean }> = [
  { prefix: '/v1/ingest', service: 'ingest' },
  { prefix: '/v1/traces', service: 'ingest' },
  { prefix: '/v1/sessions', service: 'ingest' },
  { prefix: '/v1/scenarios', service: 'ingest' },
  { prefix: '/v1/streams', service: 'ingest' },
  { prefix: '/v1/admin', service: 'ingest' },
  { prefix: '/api/', service: 'registry' },
  { prefix: '/dev/', service: 'registry' },
  { prefix: '/catalogs', service: 'registry' },
  { prefix: '/health/generation', service: 'registry' },
  { prefix: '/metrics', service: 'registry', strip: true },
  { prefix: '/gate/', service: 'gate', strip: true },
  { prefix: '/query/', service: 'query', strip: true },
  { prefix: '/state/', service: 'query', strip: true },
  { prefix: '/decode/', service: 'decode', strip: true },
  { prefix: '/docs', service: 'definition' },
  { prefix: '/sync', service: 'definition' },
  { prefix: '/graph/', service: 'definition' },
  { prefix: '/definitions/', service: 'definition', strip: true },
  { prefix: '/decisions/', service: 'decision', strip: true },
  { prefix: '/decision/', service: 'decision', strip: true },
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
    const env = AUTH_MODE === 'bypass' ? 'dev' : 'prod';
    const resp = await fetch(`${REGISTRY_URL}/api/services/gateway?env=${env}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        routes: Array<{ path: string; url: string; strip?: boolean }>;
      };
      if (data.routes.length > 0) {
        dynamicRoutes = data.routes.map((r) => ({
          prefix: r.path,
          url: r.url,
          strip: r.strip ?? false,
        }));
        routesCacheExpiry = now + 60_000;
        return dynamicRoutes;
      }
    }
  } catch {
    /* fallback */
  }

  return PATH_MAP.map((r) => ({
    prefix: r.prefix,
    url: SERVICE_URLS[r.service],
    strip: r.strip ?? false,
  }));
}

// ── 미들웨어 ────────────────────────────────────────

app.use('*', cors({ origin: '*' }));

// ── 인증 ────────────────────────────────────────────

app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === '/health') return next();

  if (AUTH_MODE === 'bypass') {
    c.set('identity', 'dev');
    return next();
  }

  if (AUTH_MODE === 'api-key') {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const keys = (process.env.AUTH_API_KEYS ?? '').split(',').map((k) => k.trim());
    if (!keys.includes(auth.slice(7))) return c.json({ error: 'Forbidden' }, 403);
    c.set('identity', `key:${auth.slice(7, 15)}`);
    return next();
  }

  // jwt 모드: JWT 토큰 파싱 + perms claims 추출
  // 검증 순서: HS256 (enrichment JWT) → JWKS (Zitadel RS256) → 서명 미검증 (dev)
  if (AUTH_MODE === 'jwt') {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) return c.json({ error: 'JWT required' }, 401);
    const token = auth.slice(7);

    try {
      let payload: Record<string, unknown> | null = null;

      // 1. Enrichment JWT (HS256) 검증 시도
      if (ENRICHMENT_JWT_SECRET) {
        payload = await verifyHS256(token, ENRICHMENT_JWT_SECRET);
      }

      // 2. JWKS (RS256) 검증 시도 — enrichment JWT가 아닌 경우
      if (!payload && JWKS_VERIFIER) {
        try {
          const result = await JWKS_VERIFIER.verify(token);
          payload = result.payload;
        } catch (jwksErr) {
          // JWKS 검증 실패 시 HS256이 아닌 경우에만 에러
          if (!ENRICHMENT_JWT_SECRET) throw jwksErr;
          // 두 검증 모두 실패 — 아래에서 처리
        }
      }

      // 3. 로컬 dev: 서명 미검증 (JWKS_URL, ENRICHMENT_JWT_SECRET 모두 미설정 시)
      if (!payload && !JWKS_VERIFIER && !ENRICHMENT_JWT_SECRET) {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('invalid jwt');
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload!.exp && (payload!.exp as number) < Math.floor(Date.now() / 1000)) {
          return c.json({ error: 'Token expired' }, 401);
        }
      }

      if (!payload) {
        return c.json({ error: 'Invalid JWT — signature verification failed' }, 401);
      }

      // id_token에 perms가 없으면 Zitadel user metadata에서 조회
      if (!payload.perms) {
        const enriched = await fetchPermsFromZitadel(String(payload.sub ?? ''));
        if (enriched) {
          payload.perms = enriched.perms;
          payload.perms_v = enriched.perms_v;
          payload.perms_schema = enriched.perms_schema;
        }
      }

      if (!payload.perms) return c.json({ error: 'No permission claims in token' }, 403);

      c.set('identity', String(payload.sub ?? payload.email ?? 'jwt-user'));
      c.set('perms', JSON.stringify(payload.perms));
      c.set('perms_v', String(payload.perms_v ?? 0));
      c.set('perms_schema', String(payload.perms_schema ?? ''));
      return next();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('expired')) return c.json({ error: 'Token expired' }, 401);
      if (msg.includes('signature')) return c.json({ error: 'Invalid signature' }, 401);
      return c.json({ error: 'Invalid JWT', detail: msg }, 401);
    }
  }

  // tailscale 모드: Tailscale-User-Login 헤더 확인 (tailscale serve가 주입)
  if (AUTH_MODE === 'tailscale') {
    const tsUser = c.req.header('Tailscale-User-Login');
    const _tsName = c.req.header('Tailscale-User-Name');
    if (!tsUser) return c.json({ error: 'Tailscale auth required' }, 401);
    c.set('identity', tsUser);
    return next();
  }

  return c.json({ error: 'Unknown auth mode' }, 500);
});

// ── Permission 체크 미들웨어 (AUTH_MODE=jwt일 때만) ──

if (AUTH_MODE === 'jwt') {
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    const required = getRoutePermission(url.pathname);

    // 공개 경로 or 매핑 없음 -> 통과
    if (!required) return next();

    const permsStr = c.get('perms');
    if (!permsStr) return c.json({ error: 'No permissions' }, 403);

    try {
      const perms = JSON.parse(permsStr) as Record<string, string>;
      if (!checkPermission(perms, required.domain, required.feature)) {
        return c.json(
          {
            error: 'Forbidden',
            required: `${required.domain}.${required.feature}`,
            message: `이 API에 접근하려면 ${required.domain}.${required.feature} 권한이 필요합니다`,
          },
          403,
        );
      }
    } catch {
      return c.json({ error: 'Invalid permission claims' }, 403);
    }

    return next();
  });
}

// ── 헬스체크 ────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'gateway',
    auth: AUTH_MODE,
    mode: 'node',
  });
});

// ── 프록시 ──────────────────────────────────────────

app.all('*', async (c) => {
  const url = new URL(c.req.url);
  const routes = await getRoutes();

  for (const route of routes) {
    if (url.pathname.startsWith(route.prefix)) {
      const targetPath = route.strip
        ? url.pathname.slice(route.prefix.replace(/\/$/, '').length) || '/'
        : url.pathname;
      const targetUrl = `${route.url}${targetPath}${url.search}`;
      const headers = new Headers(c.req.raw.headers);
      headers.set('X-Gateway-Identity', c.get('identity') ?? 'unknown');
      headers.delete('Authorization');

      // body: arrayBuffer로 읽어서 전달 (stream 소비 문제 방지)
      let body: ArrayBuffer | undefined;
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
        try {
          body = await c.req.arrayBuffer();
        } catch {
          /* empty body */
        }
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ error: 'Service unavailable', message }, 502);
      }
    }
  }

  return c.json({ error: 'Not found', path: url.pathname }, 404);
});

// ── 서버 시작 ───────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[gateway] http://localhost:${info.port} (auth: ${AUTH_MODE})`);
  console.log(`[gateway] Tailscale: tailscale serve --bg ${info.port}`);
});
