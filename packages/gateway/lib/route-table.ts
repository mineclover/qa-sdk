/**
 * 게이트웨이 라우팅 테이블 — Node(server.ts)와 CF Worker(worker.ts)가 함께 쓰는 정본.
 *
 * strip 규칙: 서비스 라우트가 접두사를 포함하면(gate `/gate/check`, decode `/decode/batch`,
 * query `/state`, registry `/metrics`) strip하지 않는다. strip은 게이트웨이 전용 별칭
 * (`/query/resolve` → `/resolve`, `/definitions/docs` → `/docs`)에만 쓴다.
 *
 * registry `/api/services/gateway`가 내려주는 동적 라우트도 같은 매칭 규칙(matchRoute)을 쓴다.
 */

export type GatewayServiceId =
  | 'ingest'
  | 'registry'
  | 'gate'
  | 'query'
  | 'decode'
  | 'definition'
  | 'decision';

export interface GatewayServiceTarget {
  /** 서비스 URL을 덮어쓰는 환경변수 이름 */
  readonly urlEnv: string;
  readonly defaultUrl: string;
  /** CF Service Binding 이름 */
  readonly bindingKey: string;
}

export const GATEWAY_SERVICES: Readonly<Record<GatewayServiceId, GatewayServiceTarget>> = {
  ingest: {
    urlEnv: 'INGEST_URL',
    defaultUrl: 'http://localhost:3200',
    bindingKey: 'INGEST_SERVICE',
  },
  registry: {
    urlEnv: 'REGISTRY_URL',
    defaultUrl: 'http://localhost:3300',
    bindingKey: 'REGISTRY_SERVICE',
  },
  gate: { urlEnv: 'GATE_URL', defaultUrl: 'http://localhost:3400', bindingKey: 'GATE_SERVICE' },
  query: { urlEnv: 'QUERY_URL', defaultUrl: 'http://localhost:3500', bindingKey: 'QUERY_SERVICE' },
  decode: {
    urlEnv: 'DECODE_URL',
    defaultUrl: 'http://localhost:3600',
    bindingKey: 'DECODE_SERVICE',
  },
  definition: {
    urlEnv: 'DEFINITION_URL',
    defaultUrl: 'http://localhost:3700',
    bindingKey: 'DEFINITION_SERVICE',
  },
  decision: {
    urlEnv: 'DECISION_URL',
    defaultUrl: 'http://localhost:3800',
    bindingKey: 'DECISION_SERVICE',
  },
};

export interface GatewayRoute<S = GatewayServiceId> {
  /** 경로 세그먼트 단위 접두사. 끝의 `/`는 무시한다 */
  readonly prefix: string;
  readonly service: S;
  /** true면 접두사를 떼고 전달 (게이트웨이 별칭 전용) */
  readonly strip?: boolean;
}

export const GATEWAY_ROUTES: readonly GatewayRoute[] = [
  // ingest — 공개 API는 모두 /v1 아래
  { prefix: '/v1', service: 'ingest' },
  // registry
  { prefix: '/api', service: 'registry' },
  { prefix: '/dev', service: 'registry' },
  { prefix: '/catalogs', service: 'registry' },
  { prefix: '/metrics', service: 'registry' },
  { prefix: '/health', service: 'registry' },
  // gate·decode — 서비스 라우트가 접두사를 포함
  { prefix: '/gate', service: 'gate' },
  { prefix: '/decode', service: 'decode' },
  // query — /query는 별칭, /state는 서비스 라우트
  { prefix: '/query', service: 'query', strip: true },
  { prefix: '/state', service: 'query' },
  // definition — 서비스 라우트 + 별칭
  { prefix: '/docs', service: 'definition' },
  { prefix: '/sync', service: 'definition' },
  { prefix: '/graph', service: 'definition' },
  { prefix: '/definitions', service: 'definition', strip: true },
  { prefix: '/def', service: 'definition', strip: true },
  // decision — 별칭
  { prefix: '/decisions', service: 'decision', strip: true },
  { prefix: '/decision', service: 'decision', strip: true },
];

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** pathname이 prefix 세그먼트 경계에서 시작하는가 (`/decode`는 `/decode-map`과 맞지 않는다) */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  const base = normalizePrefix(prefix);
  if (base === '/') return true;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** 가장 긴 접두사가 이기는 매칭 — 테이블 순서에 의존하지 않는다 */
export function matchRoute<R extends { readonly prefix: string }>(
  routes: readonly R[],
  pathname: string,
): R | undefined {
  let best: R | undefined;
  let bestLength = -1;
  for (const route of routes) {
    const length = normalizePrefix(route.prefix).length;
    if (length > bestLength && matchesPrefix(pathname, route.prefix)) {
      best = route;
      bestLength = length;
    }
  }
  return best;
}

/** 서비스에 전달할 경로 */
export function targetPath(
  route: { readonly prefix: string; readonly strip?: boolean },
  pathname: string,
): string {
  if (!route.strip) return pathname;
  const base = normalizePrefix(route.prefix);
  return base === '/' ? pathname : pathname.slice(base.length) || '/';
}
