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
