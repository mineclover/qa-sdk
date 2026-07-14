// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 인증 미들웨어 — 게이트웨이 레벨 인증 (ADR-001).
 *
 * 서비스 내부에서 직접 인증하지 않고, 게이트웨이가 전달하는 컨텍스트를 신뢰한다.
 * CF Access JWT 검증 또는 API key 검증을 제공.
 *
 * 사용법:
 *   app.use("*", createAuthMiddleware({ mode: "cf-access", teamDomain: "myteam" }));
 *   app.use("*", createAuthMiddleware({ mode: "api-key", keys: ["key1", "key2"] }));
 *   app.use("*", createAuthMiddleware({ mode: "bypass" })); // 개발용
 */

export type AuthMode = 'cf-access' | 'api-key' | 'bypass';

export interface AuthConfig {
  mode: AuthMode;
  /** CF Access: 팀 도메인 (예: "myteam.cloudflareaccess.com") */
  teamDomain?: string;
  /** API Key: 허용 키 목록 */
  keys?: readonly string[];
  /** 인증 제외 경로 (예: ["/health", "/health/live"]) */
  excludePaths?: readonly string[];
}

export interface AuthContext {
  /** 인증된 사용자/서비스 ID */
  identity: string;
  /** 인증 방식 */
  method: AuthMode;
}

/** Hono Context 최소 인터페이스 (hono에 직접 의존하지 않기 위해 복제) */
interface HonoContextLike {
  req: { url: string; header: (name: string) => string | undefined };
  set: (key: string, value: unknown) => void;
  json: (body: unknown, status: number) => Response;
}

/**
 * Hono 미들웨어 팩토리.
 *
 * bypass 모드: 항상 통과 (개발용)
 * api-key 모드: Authorization: Bearer <key> 헤더 검증
 * cf-access 모드: Cf-Access-Jwt-Assertion 헤더 검증 (기본 형식 확인만, 전체 JWT 검증은 CF가 수행)
 */
export function createAuthMiddleware(config: AuthConfig) {
  const excludePaths = new Set(config.excludePaths ?? ['/health', '/health/live']);

  return async (c: HonoContextLike, next: () => Promise<void>) => {
    // 제외 경로
    const path = new URL(c.req.url).pathname;
    if (excludePaths.has(path)) return next();

    // bypass 모드
    if (config.mode === 'bypass') {
      c.set('auth', { identity: 'dev', method: 'bypass' } satisfies AuthContext);
      return next();
    }

    // api-key 모드
    if (config.mode === 'api-key') {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing Authorization header' }, 401);
      }
      const key = authHeader.slice(7);
      if (!config.keys?.includes(key)) {
        return c.json({ error: 'Invalid API key' }, 403);
      }
      c.set('auth', {
        identity: `key:${key.slice(0, 8)}...`,
        method: 'api-key',
      } satisfies AuthContext);
      return next();
    }

    // cf-access 모드
    if (config.mode === 'cf-access') {
      const jwt = c.req.header('Cf-Access-Jwt-Assertion');
      if (!jwt) {
        return c.json({ error: 'Missing Cf-Access-Jwt-Assertion header' }, 401);
      }
      // CF Access가 이미 JWT를 검증. 여기서는 존재 확인 + 기본 파싱만.
      try {
        const parts = jwt.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');
        const payload = JSON.parse(atob(parts[1]));
        const identity = payload.email ?? payload.sub ?? 'cf-access-user';
        c.set('auth', { identity, method: 'cf-access' } satisfies AuthContext);
        return next();
      } catch {
        return c.json({ error: 'Invalid CF Access token' }, 401);
      }
    }

    return c.json({ error: 'Unknown auth mode' }, 500);
  };
}

/**
 * 환경변수에서 AuthConfig 생성.
 *
 * AUTH_MODE=bypass|api-key|cf-access
 * AUTH_API_KEYS=key1,key2 (api-key 모드)
 * AUTH_CF_TEAM_DOMAIN=myteam.cloudflareaccess.com (cf-access 모드)
 */
export function authConfigFromEnv(env: Record<string, string | undefined>): AuthConfig {
  const mode = (env.AUTH_MODE ?? 'bypass') as AuthMode;
  return {
    mode,
    teamDomain: env.AUTH_CF_TEAM_DOMAIN,
    keys: env.AUTH_API_KEYS?.split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    excludePaths: env.AUTH_EXCLUDE_PATHS?.split(',').map((p) => p.trim()),
  };
}
