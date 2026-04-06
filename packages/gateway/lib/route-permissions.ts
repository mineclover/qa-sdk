/**
 * API 라우트별 필요 permission 정의.
 *
 * domain: permission-engine의 ScopedEngine 도메인
 * feature: RoleRegistry에 등록된 feature ID
 *
 * 매칭: prefix 기반 - 가장 긴 prefix match 사용
 */

export interface RoutePermission {
  domain: string;
  feature: string;
}

const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  perm: RoutePermission;
}> = [
  // Ingest
  {
    prefix: "/v1/ingest",
    perm: { domain: "infra", feature: "ingest_write" },
  },
  {
    prefix: "/v1/admin",
    perm: { domain: "infra", feature: "ingest_admin" },
  },
  {
    prefix: "/v1/sessions",
    perm: { domain: "infra", feature: "ingest_read" },
  },
  {
    prefix: "/v1/traces",
    perm: { domain: "infra", feature: "ingest_read" },
  },
  {
    prefix: "/v1/scenarios",
    perm: { domain: "infra", feature: "ingest_read" },
  },
  {
    prefix: "/v1/streams",
    perm: { domain: "infra", feature: "ingest_read" },
  },
  {
    prefix: "/v1/insights",
    perm: { domain: "infra", feature: "ingest_read" },
  },

  // Registry
  { prefix: "/api/", perm: { domain: "infra", feature: "registry_read" } },
  { prefix: "/dev/", perm: { domain: "infra", feature: "registry_read" } },
  {
    prefix: "/catalogs",
    perm: { domain: "infra", feature: "registry_read" },
  },
  {
    prefix: "/metrics",
    perm: { domain: "infra", feature: "monitoring_read" },
  },

  // Gate / Query / Decode
  { prefix: "/gate/", perm: { domain: "infra", feature: "gate_read" } },
  { prefix: "/query/", perm: { domain: "infra", feature: "query_read" } },
  { prefix: "/decode/", perm: { domain: "infra", feature: "decode_read" } },

  // Definition
  { prefix: "/docs", perm: { domain: "infra", feature: "definition_read" } },
  {
    prefix: "/sync",
    perm: { domain: "infra", feature: "definition_write" },
  },
  {
    prefix: "/graph/",
    perm: { domain: "infra", feature: "definition_read" },
  },
  {
    prefix: "/definitions/",
    perm: { domain: "infra", feature: "definition_read" },
  },

  // Decision
  {
    prefix: "/decisions/",
    perm: { domain: "infra", feature: "decision_read" },
  },
  {
    prefix: "/decision/",
    perm: { domain: "infra", feature: "decision_read" },
  },
];

// 공개 엔드포인트 - 권한 체크 스킵
const PUBLIC_PATHS = new Set(["/health", "/health/", "/debug/healthz"]);

/**
 * 경로에 필요한 permission을 반환. 공개 경로면 null.
 */
export function getRoutePermission(
  pathname: string,
): RoutePermission | null {
  if (PUBLIC_PATHS.has(pathname)) return null;

  // Longest prefix match
  let best: RoutePermission | null = null;
  let bestLen = 0;
  for (const { prefix, perm } of ROUTE_PERMISSIONS) {
    if (pathname.startsWith(prefix) && prefix.length > bestLen) {
      best = perm;
      bestLen = prefix.length;
    }
  }

  return best;
}

// ── Feature Index 정의 ─────────────────────────────────
// enrichment-server.ts의 FEATURES 배열과 순서가 일치해야 한다.

const FEATURE_INDEX: Record<string, number> = {
  ingest_read: 0,
  ingest_write: 1,
  ingest_admin: 1, // admin은 write와 같은 비트 사용
  registry_read: 2,
  gate_read: 3,
  query_read: 4,
  decode_read: 5,
  definition_read: 6,
  definition_write: 7,
  decision_read: 8,
  decision_write: 9,
  deploy_execute: 10,
  monitoring_read: 11,
};

/**
 * JWT perms에서 특정 feature 권한이 있는지 확인.
 *
 * perms[domain]은 base64 encoded bitmask.
 * feature 이름에 대응하는 비트 인덱스를 FEATURE_INDEX에서 조회하여
 * bitmask 내 해당 비트가 켜져 있는지 확인한다.
 */
export function checkPermission(
  perms: Record<string, string>,
  domain: string,
  feature: string,
): boolean {
  const bitmaskB64 = perms[domain];
  if (!bitmaskB64) return false;

  const idx = FEATURE_INDEX[feature];
  // 알 수 없는 feature -> domain 존재만으로 허용 (fail-open)
  if (idx === undefined) return true;

  const bytes = Buffer.from(bitmaskB64, "base64");
  const byteIdx = Math.floor(idx / 8);
  const bitIdx = idx % 8;
  if (byteIdx >= bytes.length) return false;
  return (bytes[byteIdx] & (1 << bitIdx)) !== 0;
}
