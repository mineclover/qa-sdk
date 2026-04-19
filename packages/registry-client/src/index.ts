// @def.boundary registry-system
// @def.doc registry-system

import type { Logger } from "pino";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface RegistryClientOptions {
  baseUrl: string;
  cacheMaxEntries?: number;
  cacheTtlMs?: number;
  fetch?: typeof fetch;
  logger?: Pick<Logger, "warn">;
}

interface CacheEntry {
  expiresAt: number;
  value: ValidationResult;
}

class TtlLruCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string, now: number): ValidationResult | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return { ...entry.value };
  }

  set(key: string, value: ValidationResult, now: number) {
    this.pruneExpired(now);

    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, {
      expiresAt: now + this.ttlMs,
      value: { ...value },
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }

      this.entries.delete(oldestKey);
    }
  }

  private pruneExpired(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 1_000;

export class RegistryClient {
  private readonly baseUrl: string;
  private readonly cache: TtlLruCache;
  private readonly fetchImpl: typeof fetch;
  private readonly logger?: Pick<Logger, "warn">;

  constructor(options: RegistryClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.logger = options.logger;
    this.cache = new TtlLruCache(
      options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES,
      options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
    );
  }

  async validateEvent(
    serviceName: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<ValidationResult> {
    const cacheKey = JSON.stringify([serviceName, eventKey, eventVersion]);
    const now = Date.now();
    const cached = this.cache.get(cacheKey, now);

    if (cached) {
      return cached;
    }

    const url = new URL(
      `/services/${encodeURIComponent(serviceName)}/events/${encodeURIComponent(
        eventKey,
      )}/versions/${encodeURIComponent(eventVersion)}`,
      `${this.baseUrl}/`,
    );

    try {
      const response = await this.fetchImpl(url, {
        headers: this.buildHeaders(),
        method: "GET",
      });

      if (response.ok) {
        const result = { valid: true } satisfies ValidationResult;
        this.cache.set(cacheKey, result, now);
        return result;
      }

      if (response.status === 404) {
        const result = {
          valid: false,
          reason: await readErrorReason(response),
        } satisfies ValidationResult;
        this.cache.set(cacheKey, result, now);
        return result;
      }

      this.logger?.warn(
        {
          eventKey,
          eventVersion,
          serviceName,
          statusCode: response.status,
        },
        "registry validation unavailable, failing open",
      );
      return { valid: true };
    } catch (error) {
      this.logger?.warn(
        {
          err: error,
          eventKey,
          eventVersion,
          serviceName,
        },
        "registry validation unavailable, failing open",
      );
      return { valid: true };
    }
  }

  private buildHeaders(): HeadersInit {
    return {
      accept: "application/json",
    };
  }
}

async function readErrorReason(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    return payload.error?.message ?? "event not found in registry";
  } catch {
    return "event not found in registry";
  }
}

// ═══════════════════════════════════════════════════════
//  Registry Config Client — 개별 레포에서 사용
// ═══════════════════════════════════════════════════════

export interface RegistryConfig {
  /** registry-service URL */
  readonly registryUrl: string;
  /** catalog ID (default: "demo") */
  readonly catalogId?: string;
  /** 기본 환경 (default: "dev") */
  readonly env?: string;
  /** 기본 namespace (default: "shop") */
  readonly namespace?: string;
  /** 기본 region (default: "asia") */
  readonly region?: string;
  /** fetch timeout ms (default: 5000) */
  readonly timeoutMs?: number;
}

/**
 * registry-service에서 config를 받는 범용 클라이언트.
 *
 * 어떤 레포에서든 사용 가능:
 *   const client = createRegistryConfigClient({ registryUrl: "http://localhost:3300" });
 *   const endpoint = await client.resolveEndpoint({ namespace: "shop", name: "ingest-server", env: "dev", region: "asia" });
 *   const catalog = await client.fetchCatalog();
 *   const dkgConfig = await client.fetchConfig("dkg-config");
 */
export function createRegistryConfigClient(config: RegistryConfig) {
  const baseUrl = config.registryUrl.replace(/\/+$/, "");
  const catalogId = config.catalogId ?? "demo";
  const defaultEnv = config.env ?? "dev";
  const defaultNamespace = config.namespace ?? "shop";
  const defaultRegion = config.region ?? "asia";
  const timeoutMs = config.timeoutMs ?? 5_000;

  async function safeFetch(url: string): Promise<Response | null> {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return null;
    }
  }

  return {
    /** 서비스 엔드포인트 URL resolve. name만 필수, 나머지는 기본값 사용. */
    async resolveEndpoint(query: {
      name: string;
      namespace?: string;
      env?: string;
      region?: string;
    }): Promise<string | null> {
      const params = new URLSearchParams({
        catalog: catalogId,
        namespace: query.namespace ?? defaultNamespace,
        name: query.name,
        env: query.env ?? defaultEnv,
        region: query.region ?? defaultRegion,
      });
      const res = await safeFetch(`${baseUrl}/api/endpoints/resolve?${params}`);
      if (!res?.ok) return null;
      const body = await res.json() as { url?: string };
      return body.url ?? null;
    },

    /** 전체 엔드포인트 목록 */
    async listEndpoints(): Promise<Array<{
      namespace: string; svcName: string; env: string; region: string; url: string;
    }>> {
      const res = await safeFetch(`${baseUrl}/api/endpoints?catalog=${catalogId}`);
      if (!res?.ok) return [];
      return res.json() as Promise<Array<{
        namespace: string; svcName: string; env: string; region: string; url: string;
      }>>;
    },

    /** 서비스 URL 맵 (config.js 대체용). env로 dev/prod 전환. */
    async fetchServiceUrls(env?: string): Promise<Record<string, string>> {
      const e = env ?? defaultEnv;
      const params = new URLSearchParams({ catalog: catalogId, env: e, namespace: defaultNamespace, region: defaultRegion });
      const res = await safeFetch(`${baseUrl}/api/services/urls?${params}`);
      if (!res?.ok) return {};
      return res.json() as Promise<Record<string, string>>;
    },

    /** Catalog JSON fetch */
    async fetchCatalog(): Promise<unknown | null> {
      const res = await safeFetch(`${baseUrl}/catalogs/${catalogId}`);
      if (!res?.ok) return null;
      const body = await res.json() as { data?: string };
      if (!body.data) return null;
      try { return JSON.parse(body.data); } catch { return null; }
    },

    /**
     * 설정 fetch.
     * - "config" → /catalogs/:id/config (DkgConfig)
     * - "pattern-rules" → /catalogs/:id/pattern-rules
     */
    async fetchConfig(configType: string): Promise<unknown | null> {
      const res = await safeFetch(`${baseUrl}/catalogs/${catalogId}/${configType}`);
      if (!res?.ok) return null;
      const body = await res.json() as { data?: string };
      if (!body.data) return null;
      try { return JSON.parse(body.data); } catch { return null; }
    },

    /** GENERATION hash 확인 */
    async fetchGeneration(): Promise<{
      catalogHash: string;
      dkgConfigHash: string | null;
      prefixCount: number;
      axisCount: number;
    } | null> {
      const res = await safeFetch(`${baseUrl}/health/generation`);
      if (!res?.ok) return null;
      const body = await res.json() as { generations?: Record<string, {
        catalogHash: string;
        dkgConfigHash: string | null;
        prefixCount: number;
        axisCount: number;
      }> };
      return body.generations?.[catalogId] ?? null;
    },

    /** 전체 DecodeMap 목록 — decode-service 초기화용 */
    async fetchDecodeMaps(): Promise<unknown[]> {
      const res = await safeFetch(`${baseUrl}/api/decode-map?catalog=${catalogId}`);
      if (!res?.ok) return [];
      return res.json() as Promise<unknown[]>;
    },

    /** 단건 DecodeMap */
    async fetchDecodeMap(prefix: string, version: string): Promise<unknown | null> {
      const res = await safeFetch(`${baseUrl}/api/decode-map/${prefix}/${version}?catalog=${catalogId}`);
      if (!res?.ok) return null;
      return res.json() as Promise<unknown>;
    },

    /** 이벤트 스키마 목록 (서비스별 필터 가능) */
    async fetchEventSchemas(serviceId?: string): Promise<unknown[]> {
      const q = serviceId ? `&service=${serviceId}` : "";
      const res = await safeFetch(`${baseUrl}/api/event-schemas?catalog=${catalogId}${q}`);
      if (!res?.ok) return [];
      return res.json() as Promise<unknown[]>;
    },

    /** gateway 라우팅 구성 */
    async fetchGatewayRoutes(env?: string): Promise<{ routes: Array<{ path: string; serviceId: string; url: string; tier: string }>; env: string }> {
      const e = env ?? defaultEnv;
      const params = new URLSearchParams({ catalog: catalogId, env: e, namespace: defaultNamespace, region: defaultRegion });
      const res = await safeFetch(`${baseUrl}/api/services/gateway?${params}`);
      if (!res?.ok) return { routes: [], env: e };
      return res.json() as Promise<{ routes: Array<{ path: string; serviceId: string; url: string; tier: string }>; env: string }>;
    },

    /** svc-owners 맵 (prefix → serviceId) */
    async fetchSvcOwners(): Promise<Record<string, string>> {
      const res = await safeFetch(`${baseUrl}/api/services/svc-owners?catalog=${catalogId}`);
      if (!res?.ok) return {};
      return res.json() as Promise<Record<string, string>>;
    },

    /** health check */
    async isHealthy(): Promise<boolean> {
      const res = await safeFetch(`${baseUrl}/health`);
      if (!res?.ok) return false;
      const body = await res.json() as { ok?: boolean };
      return body.ok === true;
    },

    /** 현재 설정값 반환 (디버깅용) */
    get defaults() {
      return { registryUrl: baseUrl, catalogId, env: defaultEnv, namespace: defaultNamespace, region: defaultRegion };
    },
  };
}

export type RegistryConfigClient = ReturnType<typeof createRegistryConfigClient>;
